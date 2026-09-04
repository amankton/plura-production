import { describe, expect, test } from 'bun:test'
import type { StripeSubscriptionInput } from '../../src/lib/stripe/stripe-normalizers'
import type { StripeWebhookReceipt } from '../../src/lib/stripe/webhook-inbox-contract'
import type {
  StripeWebhookCustomer,
  WebhookProcessingStore,
} from '../../src/lib/stripe/webhook-processor'
import {
  runStripeWebhookWorkerOnce,
  type StripeWebhookWorkerDependencies,
} from '../../src/lib/stripe/webhook-worker'
import { InMemoryWebhookStore } from './helpers/in-memory-webhook-store'

const now = new Date('2026-09-03T18:00:00.000Z')
const firstId = '10000000-0000-4000-8000-000000000001'
const secondId = '10000000-0000-4000-8000-000000000002'

const receipt = (
  id: string,
  overrides: Partial<StripeWebhookReceipt> = {}
): StripeWebhookReceipt => ({
  accountScopeKey: 'platform',
  attempts: 0,
  completedAt: null,
  customerId: 'cus_agency',
  eventId: `evt_${id.replaceAll('-', '')}`,
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

const subscription = (): StripeSubscriptionInput => ({
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
})

const customer = (): StripeWebhookCustomer => ({
  id: 'cus_agency',
  metadata: { crewframeAgencyId: 'agency_a' },
})

const setup = (receipts: StripeWebhookReceipt[] = [receipt(firstId)]) => {
  const store = new InMemoryWebhookStore()
  for (const value of receipts) store.add(value)
  let providerCalls = 0
  let agencyCalls = 0
  let token = 0
  const dependencies: StripeWebhookWorkerDependencies = {
    agencies: {
      findAgenciesByCustomerId: async () => {
        agencyCalls += 1
        return [{ customerId: 'cus_agency', id: 'agency_a' }]
      },
    },
    dueWork: {
      listDueReceiptIds: async ({ limit }) =>
        receipts.slice(0, limit).map(({ id }) => id),
    },
    now: () => now,
    provider: {
      retrieveCustomer: async () => {
        providerCalls += 1
        return customer()
      },
      retrieveSubscription: async () => {
        providerCalls += 1
        return subscription()
      },
    },
    randomToken: () => `lease-${++token}`,
    store,
  }
  return {
    dependencies,
    getAgencyCalls: () => agencyCalls,
    getProviderCalls: () => providerCalls,
    store,
  }
}

describe('bounded Stripe webhook run-once worker', () => {
  test('rejects invalid limits before due-work or persistence access', async () => {
    const context = setup()
    let selections = 0
    context.dependencies.dueWork.listDueReceiptIds = async () => {
      selections += 1
      return []
    }
    for (const limit of [0, 1.5, 26, Number.NaN]) {
      expect(
        runStripeWebhookWorkerOnce({ limit }, context.dependencies)
      ).rejects.toBeInstanceOf(TypeError)
    }
    expect(selections).toBe(0)
    expect(context.store.receipts.get(firstId)?.status).toBe('RECEIVED')
  })

  test('cancellation before selection performs no work', async () => {
    const context = setup()
    const controller = new AbortController()
    controller.abort()
    context.dependencies.dueWork.listDueReceiptIds = async () => {
      throw new Error('due work must not be read')
    }
    expect(
      await runStripeWebhookWorkerOnce(
        { limit: 1, signal: controller.signal },
        context.dependencies
      )
    ).toEqual({
      attempted: 0,
      busy: 0,
      cancelled: true,
      deadLetter: 0,
      failed: 0,
      ignored: 0,
      notFound: 0,
      retry: 0,
      selected: 0,
      succeeded: 0,
    })
  })

  test('returns a bounded zero summary for an empty run', async () => {
    const context = setup([])
    expect(
      await runStripeWebhookWorkerOnce({ limit: 25 }, context.dependencies)
    ).toEqual({
      attempted: 0,
      busy: 0,
      cancelled: false,
      deadLetter: 0,
      failed: 0,
      ignored: 0,
      notFound: 0,
      retry: 0,
      selected: 0,
      succeeded: 0,
    })
    expect(context.getProviderCalls()).toBe(0)
    expect(context.getAgencyCalls()).toBe(0)
  })

  test('processes a finite selected batch sequentially', async () => {
    const context = setup([receipt(firstId), receipt(secondId)])
    let concurrentProviderCalls = 0
    let maximumConcurrentProviderCalls = 0
    context.dependencies.provider.retrieveSubscription = async () => {
      concurrentProviderCalls += 1
      maximumConcurrentProviderCalls = Math.max(
        maximumConcurrentProviderCalls,
        concurrentProviderCalls
      )
      await Promise.resolve()
      concurrentProviderCalls -= 1
      return subscription()
    }
    expect(
      await runStripeWebhookWorkerOnce({ limit: 2 }, context.dependencies)
    ).toMatchObject({
      attempted: 2,
      cancelled: false,
      selected: 2,
      succeeded: 2,
    })
    expect(maximumConcurrentProviderCalls).toBe(1)
    expect(context.store.projections).toHaveLength(2)
  })

  test('connected and unsupported receipts become durable ignored work', async () => {
    const context = setup([
      receipt(firstId, { accountScopeKey: 'connected:acct_agency' }),
      receipt(secondId, { eventType: 'product.updated' }),
    ])
    expect(
      await runStripeWebhookWorkerOnce({ limit: 2 }, context.dependencies)
    ).toMatchObject({ attempted: 2, ignored: 2, selected: 2 })
    expect(context.getProviderCalls()).toBe(0)
    expect(context.getAgencyCalls()).toBe(0)
    expect(context.store.objectLeases.size).toBe(0)
    expect(context.store.receipts.get(firstId)?.status).toBe('IGNORED')
    expect(context.store.receipts.get(secondId)?.status).toBe('IGNORED')
  })

  test('cancellation during an item awaits it and prevents another claim', async () => {
    const context = setup([receipt(firstId), receipt(secondId)])
    const controller = new AbortController()
    context.dependencies.provider.retrieveSubscription = async () => {
      controller.abort()
      await Promise.resolve()
      return subscription()
    }
    expect(
      await runStripeWebhookWorkerOnce(
        { limit: 2, signal: controller.signal },
        context.dependencies
      )
    ).toMatchObject({
      attempted: 1,
      cancelled: true,
      selected: 2,
      succeeded: 1,
    })
    expect(context.store.receipts.get(firstId)?.status).toBe('SUCCEEDED')
    expect(context.store.receipts.get(secondId)?.status).toBe('RECEIVED')
  })

  test('contains poison-item and observer failures without stopping the batch', async () => {
    const context = setup([receipt(firstId), receipt(secondId)])
    const backingStore = context.store
    const store: WebhookProcessingStore = {
      claimObjectLease: (input) => backingStore.claimObjectLease(input),
      claimReceipt: (input) => backingStore.claimReceipt(input),
      completeIgnored: (input) => backingStore.completeIgnored(input),
      failReceipt: (input) => backingStore.failReceipt(input),
      getReceipt: async (receiptId) => {
        if (receiptId === firstId) throw new Error('hostile poison details')
        return backingStore.getReceipt(receiptId)
      },
      projectAndComplete: (input) => backingStore.projectAndComplete(input),
    }
    context.dependencies.store = store
    context.dependencies.observe = () => {
      throw new Error('observer failure')
    }
    expect(
      await runStripeWebhookWorkerOnce({ limit: 2 }, context.dependencies)
    ).toMatchObject({ attempted: 2, failed: 1, selected: 2, succeeded: 1 })
    expect(context.store.receipts.get(secondId)?.status).toBe('SUCCEEDED')
  })

  test('repeated explicit runs preserve the durable terminal result', async () => {
    const context = setup()
    expect(
      await runStripeWebhookWorkerOnce({ limit: 1 }, context.dependencies)
    ).toMatchObject({ attempted: 1, selected: 1, succeeded: 1 })
    expect(context.getProviderCalls()).toBe(2)
    expect(
      await runStripeWebhookWorkerOnce({ limit: 1 }, context.dependencies)
    ).toMatchObject({ attempted: 1, selected: 1, succeeded: 1 })
    expect(context.getProviderCalls()).toBe(2)
    expect(context.store.projections).toHaveLength(1)
  })

  test('contains a post-claim object-store fault and later recovers the lease', async () => {
    const context = setup([
      receipt(firstId, {
        objectId: 'sub_first',
        subscriptionId: 'sub_first',
      }),
      receipt(secondId, {
        objectId: 'sub_second',
        subscriptionId: 'sub_second',
      }),
    ])
    const backingStore = context.store
    const store: WebhookProcessingStore = {
      claimObjectLease: async (input) => {
        if (input.key.objectId === 'sub_first') {
          throw new Error('synthetic object-store fault')
        }
        return backingStore.claimObjectLease(input)
      },
      claimReceipt: (input) => backingStore.claimReceipt(input),
      completeIgnored: (input) => backingStore.completeIgnored(input),
      failReceipt: (input) => backingStore.failReceipt(input),
      getReceipt: (receiptId) => backingStore.getReceipt(receiptId),
      projectAndComplete: (input) => backingStore.projectAndComplete(input),
    }
    context.dependencies.store = store
    context.dependencies.provider.retrieveSubscription = async (input) => ({
      ...subscription(),
      id: input.subscriptionId,
    })
    expect(
      await runStripeWebhookWorkerOnce({ limit: 2 }, context.dependencies)
    ).toMatchObject({ attempted: 2, failed: 1, selected: 2, succeeded: 1 })
    expect(backingStore.receipts.get(firstId)).toMatchObject({
      attempts: 1,
      status: 'PROCESSING',
    })
    expect(backingStore.receipts.get(secondId)?.status).toBe('SUCCEEDED')

    context.dependencies.store = backingStore
    context.dependencies.dueWork.listDueReceiptIds = async () => [firstId]
    context.dependencies.now = () => new Date(now.getTime() + 60_000)
    expect(
      await runStripeWebhookWorkerOnce({ limit: 1 }, context.dependencies)
    ).toMatchObject({ attempted: 1, selected: 1, succeeded: 1 })
    expect(backingStore.receipts.get(firstId)).toMatchObject({
      attempts: 2,
      status: 'SUCCEEDED',
    })
  })

  test('contains a failure-transition fault and later recovers both leases', async () => {
    const context = setup([
      receipt(firstId, {
        objectId: 'sub_first',
        subscriptionId: 'sub_first',
      }),
      receipt(secondId, {
        objectId: 'sub_second',
        subscriptionId: 'sub_second',
      }),
    ])
    const backingStore = context.store
    const store: WebhookProcessingStore = {
      claimObjectLease: (input) => backingStore.claimObjectLease(input),
      claimReceipt: (input) => backingStore.claimReceipt(input),
      completeIgnored: (input) => backingStore.completeIgnored(input),
      failReceipt: async (input) => {
        if (input.receiptId === firstId) {
          throw new Error('synthetic failure-transition fault')
        }
        return backingStore.failReceipt(input)
      },
      getReceipt: (receiptId) => backingStore.getReceipt(receiptId),
      projectAndComplete: (input) => backingStore.projectAndComplete(input),
    }
    context.dependencies.store = store
    context.dependencies.provider.retrieveSubscription = async (input) => {
      if (input.subscriptionId === 'sub_first') {
        throw new Error('synthetic provider fault')
      }
      return { ...subscription(), id: input.subscriptionId }
    }
    expect(
      await runStripeWebhookWorkerOnce({ limit: 2 }, context.dependencies)
    ).toMatchObject({ attempted: 2, busy: 1, selected: 2, succeeded: 1 })
    expect(backingStore.receipts.get(firstId)).toMatchObject({
      attempts: 1,
      status: 'PROCESSING',
    })
    expect(backingStore.objectLeases.size).toBe(1)

    context.dependencies.store = backingStore
    context.dependencies.dueWork.listDueReceiptIds = async () => [firstId]
    context.dependencies.now = () => new Date(now.getTime() + 60_000)
    context.dependencies.provider.retrieveSubscription = async (input) => ({
      ...subscription(),
      id: input.subscriptionId,
    })
    expect(
      await runStripeWebhookWorkerOnce({ limit: 1 }, context.dependencies)
    ).toMatchObject({ attempted: 1, selected: 1, succeeded: 1 })
    expect(backingStore.receipts.get(firstId)).toMatchObject({
      attempts: 2,
      status: 'SUCCEEDED',
    })
    expect(backingStore.objectLeases.size).toBe(0)
  })

  test('rejects malformed, duplicate, or oversized due-work batches', async () => {
    for (const ids of [
      ['not-a-uuid'],
      [firstId, firstId],
      [firstId, secondId],
    ]) {
      const context = setup()
      context.dependencies.dueWork.listDueReceiptIds = async () => ids
      expect(
        runStripeWebhookWorkerOnce({ limit: 1 }, context.dependencies)
      ).rejects.toBeInstanceOf(TypeError)
      expect(context.store.receipts.get(firstId)?.status).toBe('RECEIVED')
    }
  })
})
