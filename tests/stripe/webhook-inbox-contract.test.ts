import { describe, expect, test } from 'bun:test'
import {
  STRIPE_WEBHOOK_MAX_ATTEMPTS,
  WebhookProcessingError,
  decideObjectLeaseClaim,
  decideReceiptClaim,
  decideReceiptFailure,
  toSafeWebhookError,
  webhookResponseForStatus,
  type StripeWebhookReceipt,
} from '../../src/lib/stripe/webhook-inbox-contract'

const now = new Date('2026-09-03T18:00:00.000Z')

const receipt = (
  overrides: Partial<StripeWebhookReceipt> = {}
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
  payloadHash: 'a'.repeat(64),
  providerCreatedAt: new Date('2026-09-03T17:59:00.000Z'),
  retentionExpiresAt: new Date('2026-10-03T18:00:00.000Z'),
  status: 'RECEIVED',
  subscriptionId: 'sub_agency',
  ...overrides,
})

describe('Stripe webhook inbox state contract', () => {
  test('claims received, due retry, and expired processing receipts', () => {
    for (const candidate of [
      receipt(),
      receipt({
        nextRetryAt: new Date(now.getTime() - 1),
        status: 'RETRY_PENDING',
      }),
      receipt({
        leaseExpiresAt: new Date(now.getTime() - 1),
        leaseToken: 'expired-token',
        status: 'PROCESSING',
      }),
    ]) {
      const decision = decideReceiptClaim(candidate, now, 'new-token')
      expect(decision.kind).toBe('claimed')
      if (decision.kind === 'claimed') {
        expect(decision.next.status).toBe('PROCESSING')
        expect(decision.next.attempts).toBe(candidate.attempts + 1)
        expect(decision.next.leaseToken).toBe('new-token')
        expect(decision.next.leaseExpiresAt?.getTime()).toBe(
          now.getTime() + 60_000
        )
      }
    }
  })

  test('denies terminal, active lease, and not-due retry claims', () => {
    expect(decideReceiptClaim(receipt({ status: 'SUCCEEDED' }), now, 'x')).toEqual(
      { kind: 'denied', reason: 'terminal' }
    )
    expect(
      decideReceiptClaim(
        receipt({
          leaseExpiresAt: new Date(now.getTime() + 1),
          leaseToken: 'active',
          status: 'PROCESSING',
        }),
        now,
        'x'
      )
    ).toEqual({ kind: 'denied', reason: 'active_lease' })
    expect(
      decideReceiptClaim(
        receipt({
          nextRetryAt: new Date(now.getTime() + 1),
          status: 'RETRY_PENDING',
        }),
        now,
        'x'
      )
    ).toEqual({ kind: 'denied', reason: 'not_due' })
  })

  test('dead-letters an unclaimed receipt at the attempt ceiling', () => {
    const decision = decideReceiptClaim(
      receipt({ attempts: STRIPE_WEBHOOK_MAX_ATTEMPTS }),
      now,
      'unused'
    )
    expect(decision.kind).toBe('dead-letter')
    if (decision.kind === 'dead-letter') {
      expect(decision.next.status).toBe('DEAD_LETTER')
      expect(decision.next.lastErrorCode).toBe('attempt_limit_reached')
      expect(decision.next.completedAt).toEqual(now)
    }
  })

  test('uses bounded retries and dead-letters terminal or exhausted errors', () => {
    const processing = receipt({
      attempts: 1,
      leaseExpiresAt: new Date(now.getTime() + 60_000),
      leaseToken: 'owned',
      status: 'PROCESSING',
    })
    const retry = decideReceiptFailure(
      processing,
      'owned',
      { code: 'provider_timeout', message: 'Provider timed out', retryable: true },
      now
    )
    expect(retry.responseStatus).toBe(500)
    expect(retry.next.status).toBe('RETRY_PENDING')
    expect(retry.next.nextRetryAt?.getTime()).toBe(now.getTime() + 30_000)

    const exhausted = decideReceiptFailure(
      { ...processing, attempts: STRIPE_WEBHOOK_MAX_ATTEMPTS },
      'owned',
      { code: 'provider_timeout', message: 'Provider timed out', retryable: true },
      now
    )
    expect(exhausted.responseStatus).toBe(200)
    expect(exhausted.next.status).toBe('DEAD_LETTER')

    const terminal = decideReceiptFailure(
      processing,
      'owned',
      { code: 'foreign_customer', message: 'Customer is foreign', retryable: false },
      now
    )
    expect(terminal.next.status).toBe('DEAD_LETTER')
  })

  test('applies the exact bounded delay for retry attempts one through four', () => {
    for (const [attempts, delay] of [
      [1, 30_000],
      [2, 120_000],
      [3, 600_000],
      [4, 3_600_000],
    ] as const) {
      const decision = decideReceiptFailure(
        receipt({
          attempts,
          leaseExpiresAt: new Date(now.getTime() + 60_000),
          leaseToken: 'owned',
          status: 'PROCESSING',
        }),
        'owned',
        {
          code: 'provider_timeout',
          message: 'Provider timed out',
          retryable: true,
        },
        now
      )
      expect(decision.responseStatus).toBe(500)
      expect(decision.next.status).toBe('RETRY_PENDING')
      expect(decision.next.nextRetryAt?.getTime()).toBe(now.getTime() + delay)
    }
  })

  test('requires the exact receipt lease token to transition a failure', () => {
    expect(() =>
      decideReceiptFailure(
        receipt({
          attempts: 1,
          leaseExpiresAt: new Date(now.getTime() + 60_000),
          leaseToken: 'owned',
          status: 'PROCESSING',
        }),
        'foreign',
        { code: 'failure', message: 'Failure', retryable: true },
        now
      )
    ).toThrow(WebhookProcessingError)
  })

  test('rejects a failure transition after the receipt lease expires', () => {
    expect(() =>
      decideReceiptFailure(
        receipt({
          attempts: 1,
          leaseExpiresAt: now,
          leaseToken: 'owned',
          status: 'PROCESSING',
        }),
        'owned',
        { code: 'failure', message: 'Failure', retryable: true },
        now
      )
    ).toThrow(WebhookProcessingError)
  })

  test('serializes one object until its lease expires', () => {
    const key = {
      accountScopeKey: 'platform',
      mode: 'TEST' as const,
      objectId: 'sub_agency',
      objectType: 'subscription' as const,
    }
    const first = decideObjectLeaseClaim(null, key, now, 'object-one')
    expect(first?.leaseToken).toBe('object-one')
    expect(decideObjectLeaseClaim(first, key, now, 'object-two')).toBeNull()
    expect(
      decideObjectLeaseClaim(
        first,
        key,
        new Date(now.getTime() + 60_001),
        'object-two'
      )?.leaseToken
    ).toBe('object-two')
  })

  test('acknowledges only durable terminal states', () => {
    for (const status of ['SUCCEEDED', 'IGNORED', 'DEAD_LETTER'] as const) {
      expect(webhookResponseForStatus(status)).toBe(200)
    }
    for (const status of ['RECEIVED', 'PROCESSING', 'RETRY_PENDING'] as const) {
      expect(webhookResponseForStatus(status)).toBe(503)
    }
  })

  test('never copies uncontrolled provider errors into safe diagnostics', () => {
    const unsafe = new Error(
      `${['sk', 'live', 'do', 'not', 'log'].join('_')} customer@example.com stripe-signature=secret`
    )
    expect(toSafeWebhookError(unsafe)).toEqual({
      code: 'provider_temporarily_unavailable',
      message: 'Webhook provider state could not be retrieved',
      retryable: true,
    })
    expect(
      toSafeWebhookError(
        new WebhookProcessingError(
          'FOREIGN customer!!!',
          'Safe\nmessage'.repeat(100),
          false
        )
      )
    ).toMatchObject({ code: 'foreign_customer___', retryable: false })
  })
})
