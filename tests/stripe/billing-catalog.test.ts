import { describe, expect, test } from 'bun:test'
import {
  crewframeBillingPlans,
  isCrewframePlan,
  resolveCrewframePlan,
  resolveLegacyCrewframePlan,
  type CrewframePrice,
} from '../../src/lib/stripe/billing-catalog'

const stripePrice = (
  overrides: Partial<CrewframePrice> = {}
): CrewframePrice => ({
  active: true,
  currency: 'usd',
  livemode: false,
  lookup_key: 'crewframe_basic_monthly',
  recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
  unit_amount: 4_900,
  ...overrides,
})

describe('Crewframe billing catalog', () => {
  test('defines environment-neutral logical plans and stable lookup keys', () => {
    expect(crewframeBillingPlans).toEqual([
      {
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        lookupKey: 'crewframe_basic_monthly',
        plan: 'BASIC',
        unitAmount: 4_900,
      },
      {
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        lookupKey: 'crewframe_unlimited_monthly',
        plan: 'UNLIMITED',
        unitAmount: 19_900,
      },
    ])
  })

  test('accepts Test and Live prices only when mode and terms match', () => {
    expect(resolveCrewframePlan(stripePrice(), false)).toBe('BASIC')
    expect(
      resolveCrewframePlan(
        stripePrice({
          livemode: true,
          lookup_key: 'crewframe_unlimited_monthly',
          unit_amount: 19_900,
        }),
        true
      )
    ).toBe('UNLIMITED')

    for (const candidate of [
      stripePrice({ active: false }),
      stripePrice({ currency: 'eur' }),
      stripePrice({ livemode: true }),
      stripePrice({ lookup_key: 'unknown' }),
      stripePrice({ recurring: null }),
      stripePrice({
        recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' },
      }),
      stripePrice({ unit_amount: 5_000 }),
    ]) {
      expect(resolveCrewframePlan(candidate, false)).toBeNull()
    }
  })

  test('accepts only logical selectors and maps both legacy values', () => {
    expect(isCrewframePlan('BASIC')).toBe(true)
    expect(isCrewframePlan('UNLIMITED')).toBe(true)
    expect(isCrewframePlan('price_1UBgp3FHOTtuzKF5PQ6ZkvPh')).toBe(false)
    expect(
      resolveLegacyCrewframePlan('price_1OYxkqFj9oKEERu1NbKUxXxN')
    ).toBe('BASIC')
    expect(
      resolveLegacyCrewframePlan('price_1OYxkqFj9oKEERu1KfJGWxgN')
    ).toBe('UNLIMITED')
  })
})
