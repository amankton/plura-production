import { randomUUID } from 'node:crypto'
import { resolveCrewframePlan, type CrewframePlan } from './billing-catalog'
import {
  normalizeStripeSubscription,
  type StripeSubscriptionInput,
} from './stripe-normalizers'
import {
  WebhookProcessingError,
  isSubscriptionLifecycleEvent,
  isTerminalWebhookStatus,
  toSafeWebhookError,
  webhookResponseForStatus,
  type SafeWebhookError,
  type StripeWebhookObserver,
  type StripeWebhookObjectLease,
  type StripeWebhookObjectLeaseKey,
  type StripeWebhookReceipt,
} from './webhook-inbox-contract'

export type StripeWebhookCustomer = {
  deleted?: boolean
  id: string
  metadata: Record<string, string>
}

export type StripeWebhookAgency = {
  customerId: string
  id: string
}

export type StripeSubscriptionProjection = {
  active: boolean
  agencyId: string
  currentPeriodEndDate: Date
  customerId: string
  logicalPlan: CrewframePlan
  priceId: string
  subscriptionId: string
}

export type WebhookProcessingStore = {
  claimObjectLease(input: {
    key: StripeWebhookObjectLeaseKey
    leaseToken: string
    now: Date
  }): Promise<StripeWebhookObjectLease | null>
  claimReceipt(input: {
    leaseToken: string
    now: Date
    receiptId: string
  }): Promise<StripeWebhookReceipt | null>
  completeIgnored(input: {
    now: Date
    reasonCode: string
    receiptId: string
    receiptLeaseToken: string
  }): Promise<boolean>
  failReceipt(input: {
    error: SafeWebhookError
    now: Date
    objectLease?: StripeWebhookObjectLease
    receiptId: string
    receiptLeaseToken: string
  }): Promise<StripeWebhookReceipt | null>
  getReceipt(receiptId: string): Promise<StripeWebhookReceipt | null>
  projectAndComplete(input: {
    now: Date
    objectLease: StripeWebhookObjectLease
    projection: StripeSubscriptionProjection
    receiptId: string
    receiptLeaseToken: string
  }): Promise<boolean>
}

export type WebhookProviderReader = {
  retrieveCustomer(input: {
    accountScopeKey: string
    customerId: string
    mode: StripeWebhookReceipt['mode']
  }): Promise<StripeWebhookCustomer | null>
  retrieveSubscription(input: {
    accountScopeKey: string
    mode: StripeWebhookReceipt['mode']
    subscriptionId: string
  }): Promise<StripeSubscriptionInput | null>
}

export type WebhookAgencyDirectory = {
  findAgenciesByCustomerId(customerId: string): Promise<StripeWebhookAgency[]>
}

export type WebhookProcessorDependencies = {
  agencies: WebhookAgencyDirectory
  now?: () => Date
  observe?: StripeWebhookObserver
  provider: WebhookProviderReader
  randomToken?: () => string
  store: WebhookProcessingStore
}

export type WebhookProcessingResult = {
  disposition:
    | 'busy'
    | 'dead-letter'
    | 'ignored'
    | 'not-found'
    | 'retry'
    | 'succeeded'
  httpStatus: 200 | 500 | 503
  status?: StripeWebhookReceipt['status']
}

const terminal = (code: string, message: string) =>
  new WebhookProcessingError(code, message, false)

const retryable = (code: string, message: string) =>
  new WebhookProcessingError(code, message, true)

const processFailure = async (
  dependencies: WebhookProcessorDependencies,
  input: {
    error: unknown
    now: Date
    objectLease?: StripeWebhookObjectLease
    receiptId: string
    receiptLeaseToken: string
  }
): Promise<WebhookProcessingResult> => {
  try {
    const receipt = await dependencies.store.failReceipt({
      error: toSafeWebhookError(input.error),
      now: input.now,
      objectLease: input.objectLease,
      receiptId: input.receiptId,
      receiptLeaseToken: input.receiptLeaseToken,
    })
    if (!receipt) return { disposition: 'busy', httpStatus: 503 }
    if (receipt.status === 'DEAD_LETTER') {
      return {
        disposition: 'dead-letter',
        httpStatus: 200,
        status: receipt.status,
      }
    }
    return { disposition: 'retry', httpStatus: 500, status: receipt.status }
  } catch {
    return { disposition: 'busy', httpStatus: 503 }
  }
}

const processStripeWebhookReceiptWithoutObservation = async (
  receiptId: string,
  dependencies: WebhookProcessorDependencies
): Promise<WebhookProcessingResult> => {
  const initial = await dependencies.store.getReceipt(receiptId)
  if (!initial) return { disposition: 'not-found', httpStatus: 503 }
  if (isTerminalWebhookStatus(initial.status)) {
    return {
      disposition:
        initial.status === 'SUCCEEDED'
          ? 'succeeded'
          : initial.status === 'IGNORED'
            ? 'ignored'
            : 'dead-letter',
      httpStatus: webhookResponseForStatus(initial.status),
      status: initial.status,
    }
  }

  const clock = dependencies.now ?? (() => new Date())
  const claimNow = clock()
  const token = dependencies.randomToken ?? randomUUID
  const receiptLeaseToken = token()
  const receipt = await dependencies.store.claimReceipt({
    leaseToken: receiptLeaseToken,
    now: claimNow,
    receiptId,
  })
  if (!receipt) {
    const current = await dependencies.store.getReceipt(receiptId)
    if (current && isTerminalWebhookStatus(current.status)) {
      return {
        disposition:
          current.status === 'SUCCEEDED'
            ? 'succeeded'
            : current.status === 'IGNORED'
              ? 'ignored'
              : 'dead-letter',
        httpStatus: 200,
        status: current.status,
      }
    }
    return { disposition: 'busy', httpStatus: 503, status: current?.status }
  }

  if (!isSubscriptionLifecycleEvent(receipt.eventType)) {
    const completed = await dependencies.store.completeIgnored({
      now: clock(),
      reasonCode: 'unsupported_event',
      receiptId,
      receiptLeaseToken,
    })
    return completed
      ? { disposition: 'ignored', httpStatus: 200, status: 'IGNORED' }
      : { disposition: 'busy', httpStatus: 503 }
  }

  if (receipt.accountScopeKey !== 'platform') {
    const completed = await dependencies.store.completeIgnored({
      now: clock(),
      reasonCode: 'connected_account_event',
      receiptId,
      receiptLeaseToken,
    })
    return completed
      ? { disposition: 'ignored', httpStatus: 200, status: 'IGNORED' }
      : { disposition: 'busy', httpStatus: 503 }
  }

  if (!receipt.subscriptionId) {
    return processFailure(dependencies, {
      error: terminal(
        'subscription_id_missing',
        'Subscription identifier is unavailable'
      ),
      now: clock(),
      receiptId,
      receiptLeaseToken,
    })
  }

  const objectLeaseToken = token()
  const objectLease = await dependencies.store.claimObjectLease({
    key: {
      accountScopeKey: receipt.accountScopeKey,
      mode: receipt.mode,
      objectId: receipt.subscriptionId,
      objectType: 'subscription',
    },
    leaseToken: objectLeaseToken,
    now: clock(),
  })
  if (!objectLease) {
    return processFailure(dependencies, {
      error: retryable(
        'subscription_projection_busy',
        'Subscription projection is already being reconciled'
      ),
      now: clock(),
      receiptId,
      receiptLeaseToken,
    })
  }

  try {
    const subscription = await dependencies.provider.retrieveSubscription({
      accountScopeKey: receipt.accountScopeKey,
      mode: receipt.mode,
      subscriptionId: receipt.subscriptionId,
    })
    if (!subscription || subscription.id !== receipt.subscriptionId) {
      throw terminal(
        'subscription_unavailable',
        'Current subscription state is unavailable'
      )
    }

    let normalized: ReturnType<typeof normalizeStripeSubscription>
    try {
      normalized = normalizeStripeSubscription(subscription)
    } catch {
      throw terminal(
        'subscription_invalid',
        'Current subscription state is invalid'
      )
    }
    if (receipt.customerId && receipt.customerId !== normalized.customerId) {
      throw terminal(
        'subscription_customer_changed',
        'Subscription Customer does not match the signed event identity'
      )
    }

    const customer = await dependencies.provider.retrieveCustomer({
      accountScopeKey: receipt.accountScopeKey,
      customerId: normalized.customerId,
      mode: receipt.mode,
    })
    if (
      !customer ||
      customer.deleted === true ||
      customer.id !== normalized.customerId
    ) {
      throw terminal(
        'customer_unavailable',
        'Current Customer state is unavailable'
      )
    }

    const agencies = await dependencies.agencies.findAgenciesByCustomerId(
      normalized.customerId
    )
    if (agencies.length !== 1) {
      throw terminal(
        'customer_ownership_ambiguous',
        'Customer must resolve to exactly one agency'
      )
    }
    const agency = agencies[0]
    if (
      agency.customerId !== normalized.customerId ||
      customer.metadata.crewframeAgencyId !== agency.id
    ) {
      throw terminal(
        'customer_ownership_mismatch',
        'Customer ownership does not match the agency'
      )
    }

    const logicalPlan = resolveCrewframePlan(
      normalized.price,
      receipt.mode === 'LIVE'
    )
    if (!logicalPlan) {
      throw terminal(
        'subscription_price_invalid',
        'Subscription Price is not an active Crewframe plan in this mode'
      )
    }

    const completed = await dependencies.store.projectAndComplete({
      now: clock(),
      objectLease,
      projection: {
        active: normalized.active,
        agencyId: agency.id,
        currentPeriodEndDate: new Date(normalized.currentPeriodEnd * 1000),
        customerId: normalized.customerId,
        logicalPlan,
        priceId: normalized.priceId,
        subscriptionId: normalized.subscriptionId,
      },
      receiptId,
      receiptLeaseToken,
    })
    if (!completed) {
      throw retryable(
        'projection_transaction_conflict',
        'Subscription projection could not be committed'
      )
    }
    return { disposition: 'succeeded', httpStatus: 200, status: 'SUCCEEDED' }
  } catch (error) {
    return processFailure(dependencies, {
      error,
      now: clock(),
      objectLease,
      receiptId,
      receiptLeaseToken,
    })
  }
}

export const processStripeWebhookReceipt = async (
  receiptId: string,
  dependencies: WebhookProcessorDependencies
): Promise<WebhookProcessingResult> => {
  const result = await processStripeWebhookReceiptWithoutObservation(
    receiptId,
    dependencies
  )
  dependencies.observe?.(
    Object.freeze({
      code: `webhook_${result.disposition}`,
      httpStatus: result.httpStatus,
      outcome:
        result.httpStatus === 200
          ? ('terminal' as const)
          : result.httpStatus === 503
            ? ('busy' as const)
            : ('rejected' as const),
      receiptId,
      stage: 'processing' as const,
      ...(result.status ? { status: result.status } : {}),
    })
  )
  return result
}
