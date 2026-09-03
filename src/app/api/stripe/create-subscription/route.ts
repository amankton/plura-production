import { db } from '@/lib/db'
import { getStripeServerClient } from '@/lib/stripe'
import {
  requireSingleRecurringSubscriptionItem,
  requireSubscriptionClientSecret,
} from '@/lib/stripe/stripe-normalizers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { customerId, priceId } = await req.json()
  if (!customerId || !priceId)
    return new NextResponse('Customer Id or price id is missing', {
      status: 400,
    })

  const subscriptionExists = await db.agency.findFirst({
    where: { customerId },
    include: { Subscription: true },
  })

  try {
    const stripe = getStripeServerClient()
    if (
      subscriptionExists?.Subscription?.subscritiptionId &&
      subscriptionExists.Subscription.active
    ) {
      //update the subscription instead of creating one.
      if (!subscriptionExists.Subscription.subscritiptionId) {
        throw new Error(
          'Could not find the subscription Id to update the subscription.'
        )
      }
      console.log('Updating the subscription')
      const currentSubscriptionDetails = await stripe.subscriptions.retrieve(
        subscriptionExists.Subscription.subscritiptionId
      )
      const currentItem = requireSingleRecurringSubscriptionItem(
        currentSubscriptionDetails
      )

      const subscription = await stripe.subscriptions.update(
        subscriptionExists.Subscription.subscritiptionId,
        {
          items: [
            {
              id: currentItem.itemId,
              deleted: true,
            },
            { price: priceId },
          ],
          expand: ['latest_invoice.confirmation_secret'],
        }
      )
      return NextResponse.json({
        subscriptionId: subscription.id,
        clientSecret: requireSubscriptionClientSecret(subscription),
      })
    } else {
      console.log('Createing a sub')
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [
          {
            price: priceId,
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.confirmation_secret'],
      })
      return NextResponse.json({
        subscriptionId: subscription.id,
        clientSecret: requireSubscriptionClientSecret(subscription),
      })
    }
  } catch (error) {
    console.log('🔴 Error', error)
    return new NextResponse('Internal Server Error', {
      status: 500,
    })
  }
}
