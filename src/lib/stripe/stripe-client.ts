import { loadStripe, type Stripe } from '@stripe/stripe-js'

type StripeLoader = typeof loadStripe

export const createStripeClientCache = (loader: StripeLoader = loadStripe) => {
  const stripePromises = new Map<string, Promise<Stripe | null>>()

  return (connectedAccountId?: string) => {
    const cacheKey = connectedAccountId || 'platform'
    let stripePromise = stripePromises.get(cacheKey)
    if (!stripePromise) {
      stripePromise = loader(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
        connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
      )
      stripePromises.set(cacheKey, stripePromise)
    }
    return stripePromise
  }
}

export const getStripe = createStripeClientCache()
