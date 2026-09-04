import { describe, expect, test } from 'bun:test'
import type { StripeSubscriptionInput } from '../../src/lib/stripe/stripe-normalizers'
import type { StripeWebhookReceipt } from '../../src/lib/stripe/webhook-inbox-contract'
import {
  processStripeWebhookReceipt,
  type StripeWebhookCustomer,
  type WebhookProcessorDependencies,
} from '../../src/lib/stripe/webhook-processor'
import { InMemoryWebhookStore } from './helpers/in-memory-webhook-store'

const baseNow = new Date('2026-09-03T18:00:00.000Z')

const receipt = (
  id: string,
  overrides: Partial<StripeWebhookReceipt> = {}
): StripeWebhookReceipt => ({
  accountScopeKey: 'platform',
  attempts: 0,
  completedAt: null,
  customerId: 'cus_agency',
  eventId: `evt_${id}`,
  eventType: 'customer.subscription.updated',
  id,
  lastErrorCode: null,
  lastErrorMessage: null,
  leaseExpiresAt: null,
  leaseToken: null,
  mode: 'TEST',
  nextRetryAt: null,
  objectId: 'sub_agency',
  payloadHash: 'a'.repeat(64),
  providerCreatedAt: new Date('2026-09-03T17:59:00.000Z'),
  retentionExpiresAt: new Date('2026-10-03T18:00:00.000Z'),
  status: 'RECEIVED',
  subscriptionId: 'sub_agency',
  ...overrides,
})

const subscription = (
  overrides: Partial<StripeSubscriptionInput> = {}
): StripeSubscriptionInput => ({
  customer: 'cus_agency',
  id: 'sub_agency',
  items: {
    data: [
      {
        current_period_end: 1_800_000_000,
        id: 'si_agency',
        price: {
          active: true,
          currency: 'usd',
          id: 'price_basic',
          livemode: false,
          lookup_key: 'crewframe_basic_monthly',
          recurring: {
            interval: 'month',
            interval_count: 1,
            usage_type: 'licensed',
          },
          unit_amount: 4_900,
        },
      },
    ],
  },
  metadata: {},
  object: 'subscription',
  status: 'active',
  ...overrides,
})

const customer = (
  overrides: Partial<StripeWebhookCustomer> = {}
): StripeWebhookCustomer => ({
  id: 'cus_agency',
  metadata: { crewframeAgencyId: 'agency_a' },
  ...overrides,
})

const setup = (initialReceipt = receipt('10000000-0000-4000-8000-000000000001')) => {
  const store = new InMemoryWebhookStore()
  store.add(initialReceipt)
  let currentSubscription: StripeSubscriptionInput | null = subscription()
  let currentCustomer: StripeWebhookCustomer | null = customer()
  let now = baseNow
  let tokenNumber = 0
  let providerCalls = 0
  const dependencies: WebhookProcessorDependencies = {
    agencies: {
      findAgenciesByCustomerId: async () => [
        { customerId: 'cus_agency', id: 'agency_a' },
      ],
    },
    now: () => now,
    provider: {
      retrieveCustomer: async () => {
        providerCalls += 1
        return currentCustomer
      },
      retrieveSubscription: async () => {
        providerCalls += 1
        return currentSubscription
      },
    },
    randomToken: () => `lease-${++tokenNumber}`,
    store,
  }
  return {
    dependencies,
    getProviderCalls: () => providerCalls,
    setAgencies: (agencies: Array<{ customerId: string; id: string }>) => {
      dependencies.agencies.findAgenciesByCustomerId = async () => agencies
    },
    setCustomer: (value: StripeWebhookCustomer | null) => {
      currentCustomer = value
    },
    setNow: (value: Date) => {
      now = value
    },
    setSubscription: (value: StripeSubscriptionInput | null) => {
      currentSubscription = value
    },
    store,
  }
}

describe('Stripe webhook provider-state convergence', () => {
  test('projects one exact agency subscription and completes atomically', async () => {
    const context = setup()
    const result = await processStripeWebhookReceipt(
      '10000000-0000-4000-8000-000000000001',
      context.dependencies
    )
    expect(result).toEqual({
      disposition: 'succeeded',
      httpStatus: 200,
      status: 'SUCCEEDED',
    })
    expect(context.store.projections).toEqual([
      {
        active: true,
        agencyId: 'agency_a',
        currentPeriodEndDate: new Date(1_800_000_000 * 1000),
        customerId: 'cus_agency',
        logicalPlan: 'BASIC',
        priceId: 'price_basic',
        subscriptionId: 'sub_agency',
      },
    ])
    expect(
      context.store.receipts.get('10000000-0000-4000-8000-000000000001')
        ?.status
    ).toBe('SUCCEEDED')
    expect(context.store.objectLeases.size).toBe(0)
  })

  test('reordered and equal-timestamp events converge to current inactive state', async () => {
    const firstId = '10000000-0000-4000-8000-000000000011'
    const context = setup(
      receipt(firstId, {
        eventType: 'customer.subscription.created',
        providerCreatedAt: new Date('2026-09-03T17:00:00.000Z'),
      })
    )
    const secondId = '10000000-0000-4000-8000-000000000012'
    const thirdId = '10000000-0000-4000-8000-000000000013'
    context.store.add(
      receipt(secondId, {
        eventType: 'customer.subscription.deleted',
        providerCreatedAt: new Date('2026-09-03T16:00:00.000Z'),
      })
    )
    context.store.add(
      receipt(thirdId, {
        eventType: 'customer.subscription.updated',
        providerCreatedAt: new Date('2026-09-03T17:00:00.000Z'),
      })
    )
    context.setSubscription(subscription({ status: 'canceled' }))

    for (const id of [firstId, secondId, thirdId]) {
      expect(
        (await processStripeWebhookReceipt(id, context.dependencies)).status
      ).toBe('SUCCEEDED')
    }
    expect(context.store.projections).toHaveLength(3)
    expect(context.store.projections.every((entry) => !entry.active)).toBeTrue()
  })

  test('concurrent duplicate processing produces one effective projection', async () => {
    const context = setup()
    let release!: () => void
    const barrier = new Promise<void>((resolve) => {
      release = resolve
    })
    context.dependencies.provider.retrieveSubscription = async () => {
      await barrier
      return subscription()
    }
    const first = processStripeWebhookReceipt(
      '10000000-0000-4000-8000-000000000001',
      context.dependencies
    )
    await Promise.resolve()
    const second = processStripeWebhookReceipt(
      '10000000-0000-4000-8000-000000000001',
      context.dependencies
    )
    release()
    const results = await Promise.all([first, second])
    expect(results.map((result) => result.httpStatus).sort()).toEqual([200, 503])
    expect(context.store.projections).toHaveLength(1)
  })

  test('per-object lease serializes distinct receipts for one subscription', async () => {
    const firstId = '10000000-0000-4000-8000-000000000021'
    const secondId = '10000000-0000-4000-8000-000000000022'
    const context = setup(receipt(firstId))
    context.store.add(receipt(secondId))
    let release!: () => void
    const barrier = new Promise<void>((resolve) => {
      release = resolve
    })
    let retrieval = 0
    context.dependencies.provider.retrieveSubscription = async () => {
      retrieval += 1
      if (retrieval === 1) await barrier
      return subscription()
    }
    const first = processStripeWebhookReceipt(firstId, context.dependencies)
    await Promise.resolve()
    await Promise.resolve()
    const second = await processStripeWebhookReceipt(secondId, context.dependencies)
    expect(second.httpStatus).toBe(500)
    expect(context.store.receipts.get(secondId)?.status).toBe('RETRY_PENDING')
    release()
    expect((await first).status).toBe('SUCCEEDED')

    context.setNow(new Date(baseNow.getTime() + 30_001))
    expect(
      (await processStripeWebhookReceipt(secondId, context.dependencies)).status
    ).toBe('SUCCEEDED')
  })

  test('ignores unsupported and connected-account events before provider access', async () => {
    for (const overrides of [
      { eventType: 'product.updated' },
      { accountScopeKey: 'connected:acct_other' },
    ]) {
      const context = setup(receipt(crypto.randomUUID(), overrides))
      const id = Array.from(context.store.receipts.keys())[0]
      expect(
        await processStripeWebhookReceipt(id, context.dependencies)
      ).toMatchObject({ disposition: 'ignored', httpStatus: 200 })
      expect(context.getProviderCalls()).toBe(0)
      expect(context.store.projections).toHaveLength(0)
    }
  })

  test('fails closed for foreign, ambiguous, deleted, or invalid provider state', async () => {
    const cases: Array<(context: ReturnType<typeof setup>) => void> = [
      (context) => context.setAgencies([]),
      (context) =>
        context.setAgencies([
          { customerId: 'cus_agency', id: 'agency_a' },
          { customerId: 'cus_agency', id: 'agency_b' },
        ]),
      (context) => context.setCustomer(customer({ deleted: true })),
      (context) =>
        context.setCustomer(customer({ metadata: { crewframeAgencyId: 'agency_b' } })),
      (context) => context.setSubscription(null),
      (context) =>
        context.setSubscription(
          subscription({
            items: {
              data: [
                {
                  ...subscription().items.data[0],
                  price: {
                    ...subscription().items.data[0].price,
                    lookup_key: 'foreign_plan',
                  },
                },
              ],
            },
          })
        ),
      (context) =>
        context.setSubscription(
          subscription({
            items: {
              data: [
                {
                  ...subscription().items.data[0],
                  price: {
                    ...subscription().items.data[0].price,
                    livemode: true,
                  },
                },
              ],
            },
          })
        ),
    ]

    for (const arrange of cases) {
      const context = setup()
      arrange(context)
      const result = await processStripeWebhookReceipt(
        '10000000-0000-4000-8000-000000000001',
        context.dependencies
      )
      expect(result).toMatchObject({ disposition: 'dead-letter', httpStatus: 200 })
      expect(context.store.projections).toHaveLength(0)
      expect(
        context.store.receipts.get('10000000-0000-4000-8000-000000000001')
          ?.status
      ).toBe('DEAD_LETTER')
    }
  })

  test('retries sanitized transient failures and atomically rolls back conflicts', async () => {
    const providerFailure = setup()
    providerFailure.dependencies.provider.retrieveSubscription = async () => {
      throw new Error(
        `${['sk', 'live', 'secret'].join('_')} customer@example.com raw-provider-error`
      )
    }
    const result = await processStripeWebhookReceipt(
      '10000000-0000-4000-8000-000000000001',
      providerFailure.dependencies
    )
    expect(result).toMatchObject({ disposition: 'retry', httpStatus: 500 })
    const failed = providerFailure.store.receipts.get(
      '10000000-0000-4000-8000-000000000001'
    )!
    expect(failed.lastErrorCode).toBe('provider_temporarily_unavailable')
    expect(failed.lastErrorMessage).not.toContain(['sk', 'live'].join('_'))
    expect(providerFailure.store.projections).toHaveLength(0)

    const transactionFailure = setup()
    transactionFailure.store.failTransaction = true
    expect(
      await processStripeWebhookReceipt(
        '10000000-0000-4000-8000-000000000001',
        transactionFailure.dependencies
      )
    ).toMatchObject({ disposition: 'retry', httpStatus: 500 })
    expect(transactionFailure.store.projections).toHaveLength(0)
    expect(transactionFailure.store.objectLeases.size).toBe(0)
  })
})
