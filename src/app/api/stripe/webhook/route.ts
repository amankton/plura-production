import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { getStripeServerClient } from '@/lib/stripe'
import { synchronizeSubscription } from '@/lib/stripe/subscription-sync'
import { selectSubscriptionLifecycleEvent } from '@/lib/stripe/stripe-normalizers'

export async function POST(req: NextRequest) {
  let stripeEvent: Stripe.Event
  const body = await req.text()
  const sig = headers().get('Stripe-Signature')
  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? process.env.STRIPE_WEBHOOK_SECRET
  try {
    if (!sig || !webhookSecret) {
      return new NextResponse(
        'Webhook signature verification is unavailable',
        { status: 400 }
      )
    }
    const stripe = getStripeServerClient()
    stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (error) {
    console.error('Stripe webhook signature verification failed')
    return new NextResponse('Webhook signature verification failed', {
      status: 400,
    })
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
        await synchronizeSubscription(subscription)
        console.log('Stripe subscription synchronized', subscription.id)
      } else {
        console.log('Connected-account subscription event skipped')
      }
    }
  } catch {
    console.error('Stripe webhook processing failed')
    return new NextResponse('Webhook processing failed', { status: 500 })
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
