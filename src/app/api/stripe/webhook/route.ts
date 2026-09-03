import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { getStripeServerClient } from '@/lib/stripe'
import { subscriptionCreated } from '@/lib/stripe/stripe-actions'
import { selectSubscriptionLifecycleEvent } from '@/lib/stripe/stripe-normalizers'

export async function POST(req: NextRequest) {
  let stripeEvent: Stripe.Event
  const body = await req.text()
  const sig = headers().get('Stripe-Signature')
  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? process.env.STRIPE_WEBHOOK_SECRET
  try {
    if (!sig || !webhookSecret) {
      console.log(
        '🔴 Error Stripe webhook secret or the signature does not exist.'
      )
      return
    }
    const stripe = getStripeServerClient()
    stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook'
    console.log(`🔴 Error ${message}`)
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 })
  }

  //
  try {
    const selectedEvent = selectSubscriptionLifecycleEvent(stripeEvent)
    if (selectedEvent) {
      const { subscription } = selectedEvent
      if (
        !subscription.metadata.connectAccountPayments &&
        !subscription.metadata.connectAccountSubscriptions
      ) {
        await subscriptionCreated(subscription)
        console.log('SYNCHRONIZED FROM WEBHOOK 💳', subscription.id)
      } else {
        console.log(
          'SKIPPED FROM WEBHOOK 💳 because subscription was from a connected account not for the application',
          subscription
        )
      }
    }
  } catch (error) {
    console.log(error)
    return new NextResponse('🔴 Webhook Error', { status: 400 })
  }
  return NextResponse.json(
    {
      webhookActionReceived: true,
    },
    {
      status: 200,
    }
  )
}
