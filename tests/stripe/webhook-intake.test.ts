import { describe, expect, test } from 'bun:test'
import {
  STRIPE_WEBHOOK_BODY_LIMIT_BYTES,
  STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
  type StripeWebhookReceipt,
  type StripeWebhookReceiptDraft,
} from '../../src/lib/stripe/webhook-inbox-contract'
import {
  createStripeSdkWebhookVerifier,
  receiveStripeWebhook,
  type WebhookReceiptIntakeStore,
} from '../../src/lib/stripe/webhook-intake'

const now = new Date('2026-09-03T18:00:00.000Z')
const encoder = new TextEncoder()

const stream = (value: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(value))
      controller.close()
    },
  })

const event = (overrides: Record<string, unknown> = {}) => ({
  created: 1_788_459_540,
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
  ...overrides,
})

class IntakeStore implements WebhookReceiptIntakeStore {
  drafts: StripeWebhookReceiptDraft[] = []
  existing: StripeWebhookReceipt | null = null
  fail = false

  async insertOrGet(draft: StripeWebhookReceiptDraft) {
    if (this.fail) throw new Error('database credentials and raw payload')
    this.drafts.push(draft)
    const receipt: StripeWebhookReceipt =
      this.existing ??
      ({
        ...draft,
        attempts: 0,
        completedAt: null,
        id: '10000000-0000-4000-8000-000000000001',
        lastErrorCode: null,
        lastErrorMessage: null,
        leaseExpiresAt: null,
        leaseToken: null,
        nextRetryAt: null,
        status: 'RECEIVED',
      } satisfies StripeWebhookReceipt)
    return { inserted: !this.existing, receipt }
  }
}

const dependencies = (
  store: IntakeStore,
  verify: ({ rawBody }: { rawBody: Buffer }) => unknown = ({ rawBody }) =>
    event({ raw: rawBody.toString('utf8') })
) => ({
  now: () => now,
  receiptStore: store,
  secrets: { LIVE: 'live_signing_secret', TEST: 'test_signing_secret' },
  verifySignature: verify,
})

describe('Stripe webhook signature-first intake', () => {
  test('verifies exact raw bytes with the mode-specific secret before storing', async () => {
    const store = new IntakeStore()
    const raw = '{ "signed": true }\n'
    const seen: unknown[] = []
    const result = await receiveStripeWebhook(
      {
        body: stream(raw),
        contentLength: String(Buffer.byteLength(raw)),
        mode: 'TEST',
        signature: 't=123,v1=signature',
      },
      dependencies(store, (input) => {
        seen.push(input)
        return event()
      })
    )
    expect(result.ok).toBeTrue()
    expect(seen).toHaveLength(1)
    expect((seen[0] as { rawBody: Buffer }).rawBody.toString()).toBe(raw)
    expect(seen[0]).toMatchObject({
      secret: 'test_signing_secret',
      signature: 't=123,v1=signature',
      toleranceSeconds: STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
    })
    expect(store.drafts).toHaveLength(1)
    expect(store.drafts[0]).toMatchObject({
      accountScopeKey: 'platform',
      customerId: 'cus_agency',
      eventId: 'evt_agency',
      mode: 'TEST',
      subscriptionId: 'sub_agency',
    })
    expect(store.drafts[0].payloadHash).toMatch(/^[a-f0-9]{64}$/)
    expect(store.drafts[0].retentionExpiresAt.getTime()).toBe(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    )
  })

  test('missing, invalid, unavailable, or mode-mismatched signatures write nothing', async () => {
    const cases = [
      {
        input: { mode: 'TEST' as const, signature: null },
      },
      {
        input: { mode: 'TEST' as const, signature: 'bad' },
        verify: () => {
          throw new Error('signature mismatch')
        },
      },
      {
        input: { mode: 'LIVE' as const, signature: 'valid' },
        secrets: { TEST: 'test_signing_secret' },
      },
      {
        input: { mode: 'TEST' as const, signature: 'valid' },
        verify: () => event({ livemode: true }),
      },
    ]
    for (const candidate of cases) {
      const store = new IntakeStore()
      const result = await receiveStripeWebhook(
        { body: stream('{}'), ...candidate.input },
        {
          ...dependencies(store, candidate.verify),
          ...(candidate.secrets ? { secrets: candidate.secrets } : {}),
        }
      )
      expect(result.ok).toBeFalse()
      expect(store.drafts).toHaveLength(0)
    }
  })

  test('rejects a declared oversized body without reading or writing', async () => {
    const store = new IntakeStore()
    let readerRequested = false
    const body = {
      getReader() {
        readerRequested = true
        throw new Error('The body must not be read')
      },
    } as unknown as ReadableStream<Uint8Array>
    const result = await receiveStripeWebhook(
      {
        body,
        contentLength: String(STRIPE_WEBHOOK_BODY_LIMIT_BYTES + 1),
        mode: 'TEST',
        signature: 'valid',
      },
      dependencies(store)
    )
    expect(result).toEqual({ code: 'body_too_large', httpStatus: 413, ok: false })
    expect(readerRequested).toBeFalse()
    expect(store.drafts).toHaveLength(0)
  })

  test.each([undefined, '1'])(
    'cancels an oversized stream before consuming its tail with Content-Length %s',
    async (contentLength) => {
      const store = new IntakeStore()
      let cancelled = false
      let tailConsumed = false
      let pull = 0
      const body = new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true
        },
        pull(controller) {
          pull += 1
          if (pull === 1) {
            controller.enqueue(new Uint8Array(STRIPE_WEBHOOK_BODY_LIMIT_BYTES))
          } else if (pull === 2) {
            controller.enqueue(new Uint8Array(1))
          } else {
            tailConsumed = true
            controller.enqueue(encoder.encode('sensitive-tail'))
            controller.close()
          }
        },
      })
      const result = await receiveStripeWebhook(
        { body, contentLength, mode: 'TEST', signature: 'valid' },
        dependencies(store)
      )
      expect(result).toEqual({ code: 'body_too_large', httpStatus: 413, ok: false })
      expect(cancelled).toBeTrue()
      expect(tailConsumed).toBeFalse()
      expect(store.drafts).toHaveLength(0)
    }
  )

  test('maps storage failure to 503 without leaking the provider error', async () => {
    const store = new IntakeStore()
    store.fail = true
    expect(
      await receiveStripeWebhook(
        { body: stream('{}'), mode: 'TEST', signature: 'valid' },
        dependencies(store, () => event())
      )
    ).toEqual({
      code: 'receipt_storage_unavailable',
      httpStatus: 503,
      ok: false,
    })
  })

  test('rejects a verified but malformed event before receipt persistence', async () => {
    for (const malformed of [
      null,
      {},
      event({ id: '' }),
      event({ id: 'customer@example.com' }),
      event({ created: Number.NaN }),
      event({ created: Number.MAX_SAFE_INTEGER }),
      event({ data: { object: { id: 'sub_agency', object: 'subscription' } } }),
    ]) {
      const store = new IntakeStore()
      const result = await receiveStripeWebhook(
        { body: stream('{}'), mode: 'TEST', signature: 'valid' },
        dependencies(store, () => malformed)
      )
      expect(result.ok).toBeFalse()
      expect(store.drafts).toHaveLength(0)
    }
  })

  test('rejects an identity collision with different signed bytes', async () => {
    const store = new IntakeStore()
    store.existing = {
      ...((await new IntakeStore().insertOrGet({
        accountScopeKey: 'platform',
        customerId: 'cus_agency',
        eventId: 'evt_agency',
        eventType: 'customer.subscription.updated',
        mode: 'TEST',
        objectId: 'sub_agency',
        payloadHash: 'f'.repeat(64),
        providerCreatedAt: now,
        retentionExpiresAt: now,
        subscriptionId: 'sub_agency',
      })).receipt),
    }
    const result = await receiveStripeWebhook(
      { body: stream('{}'), mode: 'TEST', signature: 'valid' },
      dependencies(store, () => event())
    )
    expect(result).toEqual({
      code: 'event_identity_conflict',
      httpStatus: 400,
      ok: false,
    })
  })

  test('isolates connected-account identity and retains no raw payload', async () => {
    const store = new IntakeStore()
    const result = await receiveStripeWebhook(
      { body: stream('{"private":"not stored"}'), mode: 'TEST', signature: 'valid' },
      dependencies(store, () =>
        event({ account: 'acct_agency123', type: 'product.updated' })
      )
    )
    expect(result.ok).toBeTrue()
    expect(store.drafts[0].accountScopeKey).toBe('connected:acct_agency123')
    expect(JSON.stringify(store.drafts[0])).not.toContain('not stored')
  })

  test('deduplicates concurrent identity tuples while isolating mode and account scope', async () => {
    class AtomicStore implements WebhookReceiptIntakeStore {
      readonly receipts = new Map<string, StripeWebhookReceipt>()

      async insertOrGet(draft: StripeWebhookReceiptDraft) {
        const key = `${draft.mode}:${draft.accountScopeKey}:${draft.eventId}`
        const existing = this.receipts.get(key)
        if (existing) return { inserted: false, receipt: existing }
        const stored = {
          ...draft,
          attempts: 0,
          completedAt: null,
          id: crypto.randomUUID(),
          lastErrorCode: null,
          lastErrorMessage: null,
          leaseExpiresAt: null,
          leaseToken: null,
          nextRetryAt: null,
          status: 'RECEIVED' as const,
        }
        this.receipts.set(key, stored)
        return { inserted: true, receipt: stored }
      }
    }
    const store = new AtomicStore()
    const deps = {
      now: () => now,
      receiptStore: store,
      secrets: { LIVE: 'live_signing_secret', TEST: 'test_signing_secret' },
      verifySignature: () => event(),
    }
    const deliveries = await Promise.all(
      Array.from({ length: 20 }, () =>
        receiveStripeWebhook(
          { body: stream('{}'), mode: 'TEST', signature: 'valid' },
          deps
        )
      )
    )
    expect(deliveries.filter((delivery) => delivery.ok && delivery.inserted)).toHaveLength(1)
    expect(store.receipts).toHaveLength(1)

    await receiveStripeWebhook(
      { body: stream('{}'), mode: 'LIVE', signature: 'valid' },
      { ...deps, verifySignature: () => event({ livemode: true }) }
    )
    await receiveStripeWebhook(
      { body: stream('{}'), mode: 'TEST', signature: 'valid' },
      { ...deps, verifySignature: () => event({ account: 'acct_scope2' }) }
    )
    expect(store.receipts).toHaveLength(3)
  })

  test('uses the Stripe SDK verifier for raw-byte mutation and tolerance enforcement', async () => {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe('local_webhook_verification_only')
    const secret = 'local_webhook_signing_secret'
    const payload = JSON.stringify(event())
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
      timestamp,
    })
    const verifySignature = createStripeSdkWebhookVerifier(stripe.webhooks)

    const validStore = new IntakeStore()
    expect(
      (
        await receiveStripeWebhook(
          { body: stream(payload), mode: 'TEST', signature },
          {
            now: () => now,
            receiptStore: validStore,
            secrets: { TEST: secret },
            verifySignature,
          }
        )
      ).ok
    ).toBeTrue()

    const mutatedStore = new IntakeStore()
    expect(
      await receiveStripeWebhook(
        { body: stream(`${payload} `), mode: 'TEST', signature },
        {
          now: () => now,
          receiptStore: mutatedStore,
          secrets: { TEST: secret },
          verifySignature,
        }
      )
    ).toEqual({ code: 'invalid_signature', httpStatus: 400, ok: false })
    expect(mutatedStore.drafts).toHaveLength(0)

    const expiredSignature = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
      timestamp: timestamp - STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS - 5,
    })
    const expiredStore = new IntakeStore()
    expect(
      await receiveStripeWebhook(
        { body: stream(payload), mode: 'TEST', signature: expiredSignature },
        {
          now: () => now,
          receiptStore: expiredStore,
          secrets: { TEST: secret },
          verifySignature,
        }
      )
    ).toEqual({ code: 'invalid_signature', httpStatus: 400, ok: false })
    expect(expiredStore.drafts).toHaveLength(0)
  })
})
