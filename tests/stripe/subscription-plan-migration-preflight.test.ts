import { describe, expect, test } from 'bun:test'
import { analyzeSubscriptionPlanMigration } from '../../src/lib/stripe/subscription-plan-migration-preflight'

describe('subscription plan migration preflight', () => {
  test('reports mappable, null, unknown, conflicting, and unverified rows', () => {
    const report = analyzeSubscriptionPlanMigration([
      {
        active: true,
        id: 'subscription-basic',
        plan: 'price_1OYxkqFj9oKEERu1NbKUxXxN',
        priceId: 'price_1OYxkqFj9oKEERu1NbKUxXxN',
      },
      {
        active: true,
        id: 'subscription-unverified',
        plan: 'price_1OYxkqFj9oKEERu1KfJGWxgN',
        priceId: 'price_external',
      },
      {
        active: true,
        id: 'subscription-conflict',
        plan: 'price_1OYxkqFj9oKEERu1NbKUxXxN',
        priceId: 'price_1OYxkqFj9oKEERu1KfJGWxgN',
      },
      { active: false, id: 'subscription-null', plan: null, priceId: '' },
      {
        active: true,
        id: 'subscription-unknown',
        plan: 'unknown',
        priceId: 'unknown',
      },
    ])

    expect(report.counts).toEqual({
      conflicts: 1,
      mappable: 2,
      nullLegacyPlan: 1,
      subscriptions: 5,
      unknownLegacyPlan: 1,
      unverifiedProviderPrice: 1,
    })
    expect(report.conflicts[0].subscriptionRef).toBe('subscription-conflict')
    expect(report.mappable).toEqual([
      { logicalPlan: 'BASIC', subscriptionRef: 'subscription-basic' },
      { logicalPlan: 'UNLIMITED', subscriptionRef: 'subscription-unverified' },
    ])
  })

  test('does not expose provider price identifiers in its report', () => {
    const report = analyzeSubscriptionPlanMigration([
      {
        active: true,
        id: 'subscription-a',
        plan: 'price_1OYxkqFj9oKEERu1NbKUxXxN',
        priceId: 'price_sensitive',
      },
    ])
    expect(JSON.stringify(report)).not.toContain('price_sensitive')
  })
})
