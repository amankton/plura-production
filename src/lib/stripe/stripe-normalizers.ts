import type Stripe from 'stripe'

export class StripePayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripePayloadError'
  }
}

type StripeReference = string | { id: string; deleted?: unknown } | null

export type StripeSubscriptionInput = {
  customer: StripeReference
  id: string
  items: {
    data: Array<{
      current_period_end: number
      id: string
      price: {
        active: boolean
        currency: string
        id: string
        livemode: boolean
        lookup_key: string | null
        recurring: {
          interval: string
          interval_count: number
          usage_type: string
        } | null
        unit_amount: number | null
      }
    }>
  }
  metadata: Record<string, string>
  object: 'subscription'
  status: string
}

type StripeInvoiceReference =
  | string
  | {
      confirmation_secret?: { client_secret: string } | null
      deleted?: unknown
      id: string
      object: 'invoice'
    }
  | null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string')

const isStripeReference = (value: unknown): value is StripeReference =>
  typeof value === 'string' ||
  value === null ||
  (isRecord(value) && typeof value.id === 'string')

const isSubscriptionItem = (
  value: unknown
): value is StripeSubscriptionInput['items']['data'][number] => {
  if (!isRecord(value) || !isRecord(value.price)) return false
  const recurring = value.price.recurring
  const recurringIsValid =
    recurring === null ||
    (isRecord(recurring) &&
      typeof recurring.interval === 'string' &&
      typeof recurring.interval_count === 'number' &&
      typeof recurring.usage_type === 'string')
  return (
    typeof value.id === 'string' &&
    typeof value.current_period_end === 'number' &&
    typeof value.price.active === 'boolean' &&
    typeof value.price.currency === 'string' &&
    typeof value.price.id === 'string' &&
    typeof value.price.livemode === 'boolean' &&
    (value.price.lookup_key === null ||
      typeof value.price.lookup_key === 'string') &&
    recurringIsValid &&
    (value.price.unit_amount === null ||
      typeof value.price.unit_amount === 'number')
  )
}

const requireNonBlank = (value: string, field: string) => {
  const normalized = value.trim()
  if (!normalized) throw new StripePayloadError(`${field} is missing`)
  return normalized
}

const requireReferenceId = (value: StripeReference, field: string) => {
  if (typeof value === 'string') return requireNonBlank(value, field)
  if (!value || value.deleted === true) {
    throw new StripePayloadError(`${field} is unavailable`)
  }
  return requireNonBlank(value.id, field)
}

export const requireSingleRecurringSubscriptionItem = (
  subscription: Pick<StripeSubscriptionInput, 'items'>
) => {
  const recurringItems = subscription.items.data.filter(
    (item) => item.price.recurring !== null
  )
  if (recurringItems.length !== 1) {
    throw new StripePayloadError(
      'Subscription must contain exactly one recurring item'
    )
  }

  const item = recurringItems[0]
  if (
    !Number.isSafeInteger(item.current_period_end) ||
    item.current_period_end <= 0
  ) {
    throw new StripePayloadError('Subscription period end is invalid')
  }

  return {
    currentPeriodEnd: item.current_period_end,
    itemId: requireNonBlank(item.id, 'Subscription item ID'),
    price: item.price,
    priceId: requireNonBlank(item.price.id, 'Subscription price ID'),
  }
}

export const normalizeStripeSubscription = (
  subscription: StripeSubscriptionInput
) => {
  const item = requireSingleRecurringSubscriptionItem(subscription)
  return {
    active: subscription.status === 'active',
    customerId: requireReferenceId(subscription.customer, 'Customer ID'),
    currentPeriodEnd: item.currentPeriodEnd,
    price: item.price,
    priceId: item.priceId,
    subscriptionId: requireNonBlank(subscription.id, 'Subscription ID'),
  }
}

export const requireSubscriptionClientSecret = (subscription: {
  latest_invoice: StripeInvoiceReference
}) => {
  const invoice = subscription.latest_invoice
  if (
    !invoice ||
    typeof invoice === 'string' ||
    invoice.deleted === true ||
    invoice.object !== 'invoice'
  ) {
    throw new StripePayloadError('Latest invoice is not expanded')
  }

  const clientSecret = invoice.confirmation_secret?.client_secret
  if (!clientSecret) {
    throw new StripePayloadError('Invoice confirmation secret is unavailable')
  }
  return requireNonBlank(clientSecret, 'Invoice confirmation secret')
}

const subscriptionEventTypes = new Set([
  'customer.subscription.created',
  'customer.subscription.deleted',
  'customer.subscription.updated',
])

const isSubscriptionInput = (
  value: unknown
): value is StripeSubscriptionInput => {
  if (!isRecord(value) || !isRecord(value.items)) return false
  return (
    value.object === 'subscription' &&
    typeof value.id === 'string' &&
    typeof value.status === 'string' &&
    isStripeReference(value.customer) &&
    Array.isArray(value.items.data) &&
    value.items.data.every(isSubscriptionItem) &&
    isStringRecord(value.metadata)
  )
}

export const selectSubscriptionLifecycleEvent = (event: {
  data: { object: unknown }
  type: string
}) => {
  if (!subscriptionEventTypes.has(event.type)) return null
  if (!isSubscriptionInput(event.data.object)) return null
  return { subscription: event.data.object, type: event.type }
}

export const getExpandedPrice = (
  product: Pick<Stripe.Product, 'default_price'>
): Stripe.Price | null => {
  const price = product.default_price
  return !price || typeof price === 'string' ? null : price
}
