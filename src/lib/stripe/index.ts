import 'server-only'

import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export const getStripeServerClient = () => {
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not configured')

  stripeClient ??= new Stripe(apiKey, {
    apiVersion: '2026-08-26.dahlia',
    appInfo: {
      name: 'Plura App',
      version: '0.1.0',
    },
  })
  return stripeClient
}


