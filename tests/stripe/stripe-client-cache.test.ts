import { describe, expect, test } from 'bun:test'
import type { loadStripe } from '@stripe/stripe-js'
import { createStripeClientCache } from '../../src/lib/stripe/stripe-client'

describe('Stripe.js client isolation', () => {
  test('reuses only an exact platform or connected-account context', () => {
    const calls: Array<{ key: string; stripeAccount?: string }> = []
    const loader = ((key: string, options?: { stripeAccount?: string }) => {
      calls.push({ key, stripeAccount: options?.stripeAccount })
      return Promise.resolve(null)
    }) as typeof loadStripe
    const getStripe = createStripeClientCache(loader)

    const platformA = getStripe()
    const platformB = getStripe()
    const accountA1 = getStripe('acct_a')
    const accountA2 = getStripe('acct_a')
    const accountB = getStripe('acct_b')

    expect(platformA).toBe(platformB)
    expect(accountA1).toBe(accountA2)
    expect(platformA).not.toBe(accountA1)
    expect(accountA1).not.toBe(accountB)
    expect(calls).toEqual([
      { key: '', stripeAccount: undefined },
      { key: '', stripeAccount: 'acct_a' },
      { key: '', stripeAccount: 'acct_b' },
    ])
  })
})
