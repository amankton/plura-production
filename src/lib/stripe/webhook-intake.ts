import { createHash } from 'node:crypto'
import {
  STRIPE_WEBHOOK_BODY_LIMIT_BYTES,
  STRIPE_WEBHOOK_RETENTION_MILLISECONDS,
  STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
  WebhookInputError,
  isSubscriptionLifecycleEvent,
  type StripeWebhookMode,
  type StripeWebhookObserver,
  type StripeWebhookReceipt,
  type StripeWebhookReceiptDraft,
} from './webhook-inbox-contract'

type VerifiedEvent = {
  account?: unknown
  created: unknown
  data: { object: unknown }
  id: unknown
  livemode: unknown
  type: unknown
}

export type StripeWebhookVerifier = (input: {
  rawBody: Buffer
  secret: string
  signature: string
  toleranceSeconds: number
}) => Promise<unknown> | unknown

export type StripeWebhookSignatureConstructor = {
  constructEvent(
    payload: Buffer,
    signature: string,
    secret: string,
    tolerance?: number
  ): unknown
  constructEventAsync?(
    payload: Buffer,
    signature: string,
    secret: string,
    tolerance?: number
  ): Promise<unknown>
}

export const createStripeSdkWebhookVerifier = (
  webhooks: StripeWebhookSignatureConstructor
): StripeWebhookVerifier =>
  ({ rawBody, secret, signature, toleranceSeconds }) => {
    if (webhooks.constructEventAsync) {
      return webhooks.constructEventAsync(
        rawBody,
        signature,
        secret,
        toleranceSeconds
      )
    }
    return webhooks.constructEvent(
      rawBody,
      signature,
      secret,
      toleranceSeconds
    )
  }

export type WebhookReceiptIntakeStore = {
  insertOrGet(
    draft: StripeWebhookReceiptDraft
  ): Promise<{ inserted: boolean; receipt: StripeWebhookReceipt }>
}

export type WebhookIntakeDependencies = {
  now?: () => Date
  observe?: StripeWebhookObserver
  receiptStore: WebhookReceiptIntakeStore
  secrets: Partial<Record<StripeWebhookMode, string>>
  verifySignature: StripeWebhookVerifier
}

export type WebhookIntakeInput = {
  body: ReadableStream<Uint8Array> | null
  contentLength?: string | null
  mode: StripeWebhookMode
  signature: string | null
}

export type WebhookIntakeResult =
  | {
      code: string
      httpStatus: 400 | 413 | 503
      ok: false
    }
  | {
      inserted: boolean
      ok: true
      receipt: StripeWebhookReceipt
    }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const boundedString = (value: unknown, field: string, maximum = 255) => {
  if (typeof value !== 'string') {
    throw new WebhookInputError('malformed_event', 400, `${field} is invalid`)
  }
  const normalized = value.trim()
  if (!normalized || normalized.length > maximum) {
    throw new WebhookInputError('malformed_event', 400, `${field} is invalid`)
  }
  return normalized
}

const providerId = (value: unknown, field: string, prefix?: string) => {
  const normalized = boundedString(value, field)
  const pattern = prefix
    ? new RegExp(`^${prefix}_[A-Za-z0-9]+$`)
    : /^[a-z][a-z0-9]*_[A-Za-z0-9]+$/
  if (!pattern.test(normalized)) {
    throw new WebhookInputError('malformed_event', 400, `${field} is invalid`)
  }
  return normalized
}

const referenceId = (value: unknown, field: string) => {
  if (typeof value === 'string') return providerId(value, field, 'cus')
  if (!isRecord(value) || value.deleted === true) {
    throw new WebhookInputError('malformed_event', 400, `${field} is invalid`)
  }
  return providerId(value.id, field, 'cus')
}

const readDeclaredLength = (value: string | null | undefined) => {
  if (value === null || value === undefined) return null
  if (!/^\d+$/.test(value)) {
    throw new WebhookInputError(
      'invalid_content_length',
      400,
      'Webhook Content-Length is invalid'
    )
  }
  const length = Number(value)
  if (!Number.isSafeInteger(length)) {
    throw new WebhookInputError(
      'invalid_content_length',
      400,
      'Webhook Content-Length is invalid'
    )
  }
  if (length > STRIPE_WEBHOOK_BODY_LIMIT_BYTES) {
    throw new WebhookInputError(
      'body_too_large',
      413,
      'Webhook request body is too large'
    )
  }
  return length
}

export const readBoundedStripeWebhookBody = async (
  body: ReadableStream<Uint8Array> | null,
  contentLength?: string | null
) => {
  readDeclaredLength(contentLength)
  if (!body) {
    throw new WebhookInputError(
      'missing_body',
      400,
      'Webhook request body is missing'
    )
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > STRIPE_WEBHOOK_BODY_LIMIT_BYTES) {
        await reader.cancel('webhook_body_limit_exceeded')
        throw new WebhookInputError(
          'body_too_large',
          413,
          'Webhook request body is too large'
        )
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  if (total === 0) {
    throw new WebhookInputError(
      'missing_body',
      400,
      'Webhook request body is missing'
    )
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total)
}

const normalizeVerifiedEvent = (
  value: unknown,
  mode: StripeWebhookMode,
  payloadHash: string,
  now: Date
): StripeWebhookReceiptDraft => {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new WebhookInputError(
      'malformed_event',
      400,
      'Webhook event is malformed'
    )
  }
  const event = value as VerifiedEvent
  const eventId = providerId(event.id, 'Event ID', 'evt')
  const eventType = boundedString(event.type, 'Event type')
  const expectedLivemode = mode === 'LIVE'
  if (event.livemode !== expectedLivemode) {
    throw new WebhookInputError(
      'mode_mismatch',
      400,
      'Webhook event mode does not match the endpoint'
    )
  }
  if (
    !Number.isSafeInteger(event.created) ||
    Number(event.created) <= 0 ||
    Number(event.created) > 10_000_000_000
  ) {
    throw new WebhookInputError(
      'malformed_event',
      400,
      'Webhook event timestamp is invalid'
    )
  }

  let accountScopeKey = 'platform'
  if (event.account !== undefined && event.account !== null) {
    const accountId = providerId(event.account, 'Connected account', 'acct')
    accountScopeKey = `connected:${accountId}`
  }

  let customerId: string | null = null
  let objectId: string | null = null
  let subscriptionId: string | null = null
  const object = event.data.object
  if (isRecord(object)) {
    if (typeof object.id === 'string' && object.id.trim()) {
      objectId = providerId(object.id, 'Object ID')
    }
    if (isSubscriptionLifecycleEvent(eventType)) {
      if (object.object !== 'subscription') {
        throw new WebhookInputError(
          'malformed_event',
          400,
          'Subscription event object is invalid'
        )
      }
      subscriptionId = providerId(object.id, 'Subscription ID', 'sub')
      customerId = referenceId(object.customer, 'Customer ID')
    }
  } else if (isSubscriptionLifecycleEvent(eventType)) {
    throw new WebhookInputError(
      'malformed_event',
      400,
      'Subscription event object is invalid'
    )
  }

  return {
    accountScopeKey,
    customerId,
    eventId,
    eventType,
    mode,
    objectId,
    payloadHash,
    providerCreatedAt: new Date(Number(event.created) * 1000),
    retentionExpiresAt: new Date(
      now.getTime() + STRIPE_WEBHOOK_RETENTION_MILLISECONDS
    ),
    subscriptionId,
  }
}

const receiveStripeWebhookWithoutObservation = async (
  input: WebhookIntakeInput,
  dependencies: WebhookIntakeDependencies
): Promise<WebhookIntakeResult> => {
  try {
    const signature = input.signature?.trim()
    if (!signature || signature.length > 8192) {
      throw new WebhookInputError(
        'invalid_signature',
        400,
        'Webhook signature is missing or invalid'
      )
    }
    const secret = dependencies.secrets[input.mode]?.trim()
    if (!secret) {
      return { code: 'webhook_secret_unavailable', httpStatus: 503, ok: false }
    }

    const rawBody = await readBoundedStripeWebhookBody(
      input.body,
      input.contentLength
    )
    let verified: unknown
    try {
      verified = await dependencies.verifySignature({
        rawBody,
        secret,
        signature,
        toleranceSeconds: STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
      })
    } catch {
      throw new WebhookInputError(
        'invalid_signature',
        400,
        'Webhook signature is invalid'
      )
    }

    const now = dependencies.now?.() ?? new Date()
    const payloadHash = createHash('sha256').update(rawBody).digest('hex')
    const draft = normalizeVerifiedEvent(verified, input.mode, payloadHash, now)
    try {
      const result = await dependencies.receiptStore.insertOrGet(draft)
      if (result.receipt.payloadHash !== payloadHash) {
        return { code: 'event_identity_conflict', httpStatus: 400, ok: false }
      }
      return { ...result, ok: true }
    } catch {
      return { code: 'receipt_storage_unavailable', httpStatus: 503, ok: false }
    }
  } catch (error) {
    if (error instanceof WebhookInputError) {
      return {
        code: error.code,
        httpStatus: error.httpStatus as 400 | 413,
        ok: false,
      }
    }
    return { code: 'webhook_intake_failed', httpStatus: 400, ok: false }
  }
}

export const receiveStripeWebhook = async (
  input: WebhookIntakeInput,
  dependencies: WebhookIntakeDependencies
): Promise<WebhookIntakeResult> => {
  const result = await receiveStripeWebhookWithoutObservation(input, dependencies)
  dependencies.observe?.(
    Object.freeze(
      result.ok
        ? {
            code: result.inserted ? 'receipt_stored' : 'duplicate_receipt',
            outcome: 'accepted' as const,
            receiptId: result.receipt.id,
            stage: 'intake' as const,
            status: result.receipt.status,
          }
        : {
            code: result.code,
            httpStatus: result.httpStatus,
            outcome: 'rejected' as const,
            stage: 'intake' as const,
          }
    )
  )
  return result
}
