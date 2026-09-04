export const STRIPE_WEBHOOK_BODY_LIMIT_BYTES = 256 * 1024
export const STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300
export const STRIPE_WEBHOOK_LEASE_MILLISECONDS = 60_000
export const STRIPE_WEBHOOK_RETENTION_MILLISECONDS = 30 * 24 * 60 * 60 * 1000
export const STRIPE_WEBHOOK_MAX_ATTEMPTS = 5
export const STRIPE_WEBHOOK_RETRY_DELAYS_MILLISECONDS = [
  30_000,
  120_000,
  600_000,
  3_600_000,
] as const

export const STRIPE_SUBSCRIPTION_EVENT_TYPES = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const

export type StripeWebhookMode = 'TEST' | 'LIVE'
export type StripeWebhookReceiptStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'RETRY_PENDING'
  | 'SUCCEEDED'
  | 'IGNORED'
  | 'DEAD_LETTER'

export type StripeWebhookReceipt = {
  accountScopeKey: string
  attempts: number
  completedAt: Date | null
  customerId: string | null
  eventId: string
  eventType: string
  id: string
  lastErrorCode: string | null
  lastErrorMessage: string | null
  leaseExpiresAt: Date | null
  leaseToken: string | null
  mode: StripeWebhookMode
  nextRetryAt: Date | null
  objectId: string | null
  payloadHash: string
  providerCreatedAt: Date
  retentionExpiresAt: Date
  status: StripeWebhookReceiptStatus
  subscriptionId: string | null
}

export type StripeWebhookReceiptDraft = Omit<
  StripeWebhookReceipt,
  | 'attempts'
  | 'completedAt'
  | 'id'
  | 'lastErrorCode'
  | 'lastErrorMessage'
  | 'leaseExpiresAt'
  | 'leaseToken'
  | 'nextRetryAt'
  | 'status'
>

export type StripeWebhookObjectLeaseKey = {
  accountScopeKey: string
  mode: StripeWebhookMode
  objectId: string
  objectType: 'subscription'
}

export type StripeWebhookObjectLease = StripeWebhookObjectLeaseKey & {
  leaseExpiresAt: Date
  leaseToken: string
}

export type SafeWebhookError = {
  code: string
  message: string
  retryable: boolean
}

export type StripeWebhookObservation = {
  code: string
  httpStatus?: number
  outcome: 'accepted' | 'busy' | 'rejected' | 'terminal'
  receiptId?: string
  stage: 'intake' | 'processing'
  status?: StripeWebhookReceiptStatus
}

export type StripeWebhookObserver = (
  observation: Readonly<StripeWebhookObservation>
) => void

export class WebhookInputError extends Error {
  readonly code: string
  readonly httpStatus: number

  constructor(code: string, httpStatus: number, message: string) {
    super(message)
    this.name = 'WebhookInputError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

export class WebhookProcessingError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, retryable: boolean) {
    super(message)
    this.name = 'WebhookProcessingError'
    this.code = code
    this.retryable = retryable
  }
}

export const isSubscriptionLifecycleEvent = (
  value: string
): value is (typeof STRIPE_SUBSCRIPTION_EVENT_TYPES)[number] =>
  STRIPE_SUBSCRIPTION_EVENT_TYPES.some((eventType) => eventType === value)

export const isTerminalWebhookStatus = (
  status: StripeWebhookReceiptStatus
) =>
  status === 'SUCCEEDED' || status === 'IGNORED' || status === 'DEAD_LETTER'

const sanitizeCode = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  return normalized.slice(0, 64) || 'webhook_processing_error'
}

const sanitizeMessage = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) ||
  'Webhook processing failed'

export const toSafeWebhookError = (error: unknown): SafeWebhookError => {
  if (error instanceof WebhookProcessingError) {
    return {
      code: sanitizeCode(error.code),
      message: sanitizeMessage(error.message),
      retryable: error.retryable,
    }
  }

  return {
    code: 'provider_temporarily_unavailable',
    message: 'Webhook provider state could not be retrieved',
    retryable: true,
  }
}

export type ReceiptClaimDecision =
  | {
      kind: 'claimed'
      next: StripeWebhookReceipt
    }
  | {
      kind: 'dead-letter'
      next: StripeWebhookReceipt
    }
  | {
      kind: 'denied'
      reason: 'active_lease' | 'not_due' | 'terminal'
    }

export const decideReceiptClaim = (
  receipt: StripeWebhookReceipt,
  now: Date,
  leaseToken: string
): ReceiptClaimDecision => {
  if (isTerminalWebhookStatus(receipt.status)) {
    return { kind: 'denied', reason: 'terminal' }
  }

  if (
    receipt.status === 'PROCESSING' &&
    receipt.leaseExpiresAt &&
    receipt.leaseExpiresAt.getTime() > now.getTime()
  ) {
    return { kind: 'denied', reason: 'active_lease' }
  }

  if (
    receipt.status === 'RETRY_PENDING' &&
    receipt.nextRetryAt &&
    receipt.nextRetryAt.getTime() > now.getTime()
  ) {
    return { kind: 'denied', reason: 'not_due' }
  }

  if (receipt.attempts >= STRIPE_WEBHOOK_MAX_ATTEMPTS) {
    return {
      kind: 'dead-letter',
      next: {
        ...receipt,
        completedAt: now,
        lastErrorCode: 'attempt_limit_reached',
        lastErrorMessage: 'Webhook processing attempt limit was reached',
        leaseExpiresAt: null,
        leaseToken: null,
        nextRetryAt: null,
        status: 'DEAD_LETTER',
      },
    }
  }

  return {
    kind: 'claimed',
    next: {
      ...receipt,
      attempts: receipt.attempts + 1,
      completedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      leaseExpiresAt: new Date(
        now.getTime() + STRIPE_WEBHOOK_LEASE_MILLISECONDS
      ),
      leaseToken,
      nextRetryAt: null,
      status: 'PROCESSING',
    },
  }
}

export type ReceiptFailureDecision = {
  next: StripeWebhookReceipt
  responseStatus: 200 | 500
}

export const decideReceiptFailure = (
  receipt: StripeWebhookReceipt,
  leaseToken: string,
  error: SafeWebhookError,
  now: Date
): ReceiptFailureDecision => {
  if (
    receipt.status !== 'PROCESSING' ||
    receipt.leaseToken !== leaseToken ||
    !receipt.leaseExpiresAt ||
    receipt.leaseExpiresAt.getTime() <= now.getTime()
  ) {
    throw new WebhookProcessingError(
      'invalid_receipt_lease',
      'Webhook receipt lease is no longer owned',
      true
    )
  }

  const mustDeadLetter =
    !error.retryable || receipt.attempts >= STRIPE_WEBHOOK_MAX_ATTEMPTS
  if (mustDeadLetter) {
    return {
      next: {
        ...receipt,
        completedAt: now,
        lastErrorCode: error.code,
        lastErrorMessage: error.message,
        leaseExpiresAt: null,
        leaseToken: null,
        nextRetryAt: null,
        status: 'DEAD_LETTER',
      },
      responseStatus: 200,
    }
  }

  const delay =
    STRIPE_WEBHOOK_RETRY_DELAYS_MILLISECONDS[
      Math.min(
        receipt.attempts - 1,
        STRIPE_WEBHOOK_RETRY_DELAYS_MILLISECONDS.length - 1
      )
    ]
  return {
    next: {
      ...receipt,
      completedAt: null,
      lastErrorCode: error.code,
      lastErrorMessage: error.message,
      leaseExpiresAt: null,
      leaseToken: null,
      nextRetryAt: new Date(now.getTime() + delay),
      status: 'RETRY_PENDING',
    },
    responseStatus: 500,
  }
}

export const decideObjectLeaseClaim = (
  current: StripeWebhookObjectLease | null,
  key: StripeWebhookObjectLeaseKey,
  now: Date,
  leaseToken: string
): StripeWebhookObjectLease | null => {
  if (current && current.leaseExpiresAt.getTime() > now.getTime()) return null
  return {
    ...key,
    leaseExpiresAt: new Date(
      now.getTime() + STRIPE_WEBHOOK_LEASE_MILLISECONDS
    ),
    leaseToken,
  }
}

export const webhookResponseForStatus = (
  status: StripeWebhookReceiptStatus
): 200 | 503 => (isTerminalWebhookStatus(status) ? 200 : 503)
