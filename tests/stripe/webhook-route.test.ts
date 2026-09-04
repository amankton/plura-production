import { describe, expect, test } from 'bun:test'
import type {
  StripeWebhookReceipt,
  StripeWebhookReceiptStatus,
} from '../../src/lib/stripe/webhook-inbox-contract'
import {
  handleStripeWebhookRoute,
  type StripeWebhookRouteDependencies,
} from '../../src/lib/stripe/webhook-route-handler'

const event = {
  created: 1_788_456_000,
  data: {
    object: {
      customer: 'cus_agency',
      id: 'sub_agency',
      object: 'subscription',
    },
  },
  id: 'evt_agency',
  livemode: false,
  type: 'customer.subscription.updated',
}

const receipt = (
  status: StripeWebhookReceiptStatus = 'RECEIVED'
): StripeWebhookReceipt => ({
  accountScopeKey: 'platform',
  attempts: 0,
  completedAt: null,
  customerId: 'cus_agency',
  eventId: 'evt_agency',
  eventType: 'customer.subscription.updated',
  id: '10000000-0000-4000-8000-000000000001',
  lastErrorCode: null,
  lastErrorMessage: null,
  leaseExpiresAt: null,
  leaseToken: null,
  mode: 'TEST',
  nextRetryAt: null,
  objectId: 'sub_agency',
  payloadHash: 'unused-by-helper',
  providerCreatedAt: new Date(event.created * 1000),
  retentionExpiresAt: new Date('2026-10-03T18:00:00.000Z'),
  status,
  subscriptionId: 'sub_agency',
})

const request = (overrides: { body?: string; signature?: string } = {}) => {
  const body = overrides.body ?? JSON.stringify(event)
  return new Request('https://crewframe.test/api/stripe/webhook?mode=live', {
    body,
    headers: {
      'content-length': String(Buffer.byteLength(body)),
      cookie: 'stripe_mode=live',
      'stripe-signature': overrides.signature ?? 'test-signature',
      'x-stripe-mode': 'LIVE',
    },
    method: 'POST',
  })
}

const setup = (options: {
  inserted?: boolean
  status?: StripeWebhookReceiptStatus
} = {}) => {
  const drafts: Array<{ mode: string; payloadHash: string }> = []
  let verifierCalls = 0
  let runtimeLoads = 0
  const dependencies: StripeWebhookRouteDependencies = {
    loadRuntime: async () => {
      runtimeLoads += 1
      return {
        receiptStore: {
          insertOrGet: async (draft) => {
            drafts.push({ mode: draft.mode, payloadHash: draft.payloadHash })
            return {
              inserted: options.inserted ?? true,
              receipt: {
                ...receipt(options.status),
                payloadHash: draft.payloadHash,
              },
            }
          },
        },
        verifySignature: ({ toleranceSeconds }) => {
          verifierCalls += 1
          expect(toleranceSeconds).toBe(300)
          return event
        },
      }
    },
    resolveConfig: () => ({
      enabled: true,
      mode: 'TEST',
      secret: 'test-endpoint-secret',
    }),
  }
  return {
    dependencies,
    drafts,
    getRuntimeLoads: () => runtimeLoads,
    getVerifierCalls: () => verifierCalls,
  }
}

describe('private Stripe webhook route adapter', () => {
  test('disabled configuration exits before request or runtime access', async () => {
    let runtimeLoads = 0
    const throwingRequest = {
      get body(): never {
        throw new Error('body was accessed')
      },
      get headers(): never {
        throw new Error('headers were accessed')
      },
    }
    const response = await handleStripeWebhookRoute(throwingRequest, {
      loadRuntime: async () => {
        runtimeLoads += 1
        throw new Error('runtime was loaded')
      },
      resolveConfig: () => ({ enabled: false, reason: 'disabled' }),
    })
    expect(response.status).toBe(503)
    expect(runtimeLoads).toBe(0)
  })

  test('runtime configuration failure exits before request access', async () => {
    const throwingRequest = {
      get body(): never {
        throw new Error('body was accessed')
      },
      get headers(): never {
        throw new Error('headers were accessed')
      },
    }
    const response = await handleStripeWebhookRoute(throwingRequest, {
      loadRuntime: async () => {
        throw new Error('server SDK configuration unavailable')
      },
      resolveConfig: () => ({
        enabled: true,
        mode: 'TEST',
        secret: 'test-endpoint-secret',
      }),
    })
    expect(response.status).toBe(503)
  })

  test('server configuration fixes TEST mode despite caller overrides', async () => {
    const context = setup()
    const response = await handleStripeWebhookRoute(
      request(),
      context.dependencies
    )
    expect(response.status).toBe(503)
    expect(context.drafts).toHaveLength(1)
    expect(context.drafts[0].mode).toBe('TEST')
    expect(context.getRuntimeLoads()).toBe(1)
    expect(context.getVerifierCalls()).toBe(1)
  })

  test('returns 503 for new and nonterminal receipts', async () => {
    for (const [inserted, status] of [
      [true, 'RECEIVED'],
      [false, 'RECEIVED'],
      [false, 'PROCESSING'],
      [false, 'RETRY_PENDING'],
    ] as const) {
      const context = setup({ inserted, status })
      const response = await handleStripeWebhookRoute(
        request(),
        context.dependencies
      )
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        code: 'webhook_receipt_pending',
        received: false,
      })
    }
  })

  test('returns 200 only for exact already-terminal duplicates', async () => {
    for (const status of ['SUCCEEDED', 'IGNORED', 'DEAD_LETTER'] as const) {
      const context = setup({ inserted: false, status })
      const response = await handleStripeWebhookRoute(
        request(),
        context.dependencies
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        code: 'webhook_receipt_terminal',
        received: true,
      })
    }

    const insertedTerminal = setup({ inserted: true, status: 'SUCCEEDED' })
    expect(
      (
        await handleStripeWebhookRoute(
          request(),
          insertedTerminal.dependencies
        )
      ).status
    ).toBe(503)
  })

  test('maps invalid signatures to bounded 400 responses with zero writes', async () => {
    const context = setup()
    let writes = 0
    context.dependencies.loadRuntime = async () => ({
      receiptStore: {
        insertOrGet: async () => {
          writes += 1
          throw new Error('must not write')
        },
      },
      verifySignature: () => {
        throw new Error('uncontrolled verifier details')
      },
    })
    const response = await handleStripeWebhookRoute(
      request(),
      context.dependencies
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      code: 'invalid_signature',
      received: false,
    })
    expect(writes).toBe(0)
  })
})
