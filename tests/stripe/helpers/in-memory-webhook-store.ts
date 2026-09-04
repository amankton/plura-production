import {
  decideObjectLeaseClaim,
  decideReceiptClaim,
  decideReceiptFailure,
  type StripeWebhookObjectLease,
  type StripeWebhookObjectLeaseKey,
  type StripeWebhookReceipt,
} from '../../../src/lib/stripe/webhook-inbox-contract'
import type {
  StripeSubscriptionProjection,
  WebhookProcessingStore,
} from '../../../src/lib/stripe/webhook-processor'

const objectKey = (key: StripeWebhookObjectLeaseKey) =>
  `${key.mode}:${key.accountScopeKey}:${key.objectType}:${key.objectId}`

export class InMemoryWebhookStore implements WebhookProcessingStore {
  readonly objectLeases = new Map<string, StripeWebhookObjectLease>()
  readonly projections: StripeSubscriptionProjection[] = []
  readonly receipts = new Map<string, StripeWebhookReceipt>()
  failTransaction = false

  add(receipt: StripeWebhookReceipt) {
    this.receipts.set(receipt.id, receipt)
  }

  async getReceipt(receiptId: string) {
    return this.receipts.get(receiptId) ?? null
  }

  async claimReceipt(input: {
    leaseToken: string
    now: Date
    receiptId: string
  }) {
    const receipt = this.receipts.get(input.receiptId)
    if (!receipt) return null
    const decision = decideReceiptClaim(receipt, input.now, input.leaseToken)
    if (decision.kind === 'dead-letter') {
      this.receipts.set(input.receiptId, decision.next)
      return null
    }
    if (decision.kind === 'denied') return null
    this.receipts.set(input.receiptId, decision.next)
    return decision.next
  }

  async claimObjectLease(input: {
    key: StripeWebhookObjectLeaseKey
    leaseToken: string
    now: Date
  }) {
    const key = objectKey(input.key)
    const current = this.objectLeases.get(key) ?? null
    const lease = decideObjectLeaseClaim(
      current,
      input.key,
      input.now,
      input.leaseToken
    )
    if (lease) this.objectLeases.set(key, lease)
    return lease
  }

  async completeIgnored(input: {
    now: Date
    reasonCode: string
    receiptId: string
    receiptLeaseToken: string
  }) {
    const receipt = this.receipts.get(input.receiptId)
    if (
      !receipt ||
      receipt.status !== 'PROCESSING' ||
      receipt.leaseToken !== input.receiptLeaseToken
    ) {
      return false
    }
    this.receipts.set(input.receiptId, {
      ...receipt,
      completedAt: input.now,
      lastErrorCode: input.reasonCode,
      lastErrorMessage: 'Webhook event is intentionally not processed',
      leaseExpiresAt: null,
      leaseToken: null,
      nextRetryAt: null,
      status: 'IGNORED',
    })
    return true
  }

  async failReceipt(input: {
    error: {
      code: string
      message: string
      retryable: boolean
    }
    now: Date
    objectLease?: StripeWebhookObjectLease
    receiptId: string
    receiptLeaseToken: string
  }) {
    const receipt = this.receipts.get(input.receiptId)
    if (!receipt) return null
    if (input.objectLease) {
      const key = objectKey(input.objectLease)
      const currentObjectLease = this.objectLeases.get(key)
      if (currentObjectLease?.leaseToken !== input.objectLease.leaseToken) {
        return null
      }
    }
    let decision
    try {
      decision = decideReceiptFailure(
        receipt,
        input.receiptLeaseToken,
        input.error,
        input.now
      )
    } catch {
      return null
    }
    this.receipts.set(input.receiptId, decision.next)
    if (input.objectLease) this.objectLeases.delete(objectKey(input.objectLease))
    return decision.next
  }

  async projectAndComplete(input: {
    now: Date
    objectLease: StripeWebhookObjectLease
    projection: StripeSubscriptionProjection
    receiptId: string
    receiptLeaseToken: string
  }) {
    const receipt = this.receipts.get(input.receiptId)
    const leaseKey = objectKey(input.objectLease)
    const objectLease = this.objectLeases.get(leaseKey)
    if (
      !receipt ||
      receipt.status !== 'PROCESSING' ||
      receipt.leaseToken !== input.receiptLeaseToken ||
      objectLease?.leaseToken !== input.objectLease.leaseToken ||
      receipt.leaseExpiresAt!.getTime() <= input.now.getTime() ||
      objectLease.leaseExpiresAt.getTime() <= input.now.getTime() ||
      this.failTransaction
    ) {
      return false
    }

    this.projections.push(input.projection)
    this.receipts.set(input.receiptId, {
      ...receipt,
      completedAt: input.now,
      lastErrorCode: null,
      lastErrorMessage: null,
      leaseExpiresAt: null,
      leaseToken: null,
      nextRetryAt: null,
      status: 'SUCCEEDED',
    })
    this.objectLeases.delete(leaseKey)
    return true
  }
}
