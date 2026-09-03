import { describe, expect, test } from 'bun:test'
import {
  normalizeStripeSubscription,
  requireSingleRecurringSubscriptionItem,
  requireSubscriptionClientSecret,
  selectSubscriptionLifecycleEvent,
  StripePayloadError,
  type StripeSubscriptionInput,
} from '../../src/lib/stripe/stripe-normalizers'

const subscription = (
  overrides: Partial<StripeSubscriptionInput> = {}
): StripeSubscriptionInput => ({
  customer: 'cus_a',
  id: 'sub_a',
  items: {
    data: [
      {
        current_period_end: 1_800_000_000,
        id: 'si_a',
        price: {
          active: true,
          currency: 'usd',
          id: 'price_a',
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

describe('Stripe 22 payload normalization', () => {
  test('normalizes one recurring subscription item and customer reference', () => {
    expect(normalizeStripeSubscription(subscription())).toEqual({
      active: true,
      customerId: 'cus_a',
      currentPeriodEnd: 1_800_000_000,
      price: subscription().items.data[0].price,
      priceId: 'price_a',
      subscriptionId: 'sub_a',
    })
    expect(
      normalizeStripeSubscription(subscription({ customer: { id: 'cus_b' } }))
        .customerId
    ).toBe('cus_b')
  })

  test('rejects absent, deleted, or malformed customers', () => {
    for (const customer of [null, '', { id: 'cus_a', deleted: true }]) {
      expect(() =>
        normalizeStripeSubscription(subscription({ customer }))
      ).toThrow(StripePayloadError)
    }
  })

  test('rejects no recurring item or multiple ambiguous recurring items', () => {
    expect(() =>
      requireSingleRecurringSubscriptionItem(subscription({ items: { data: [] } }))
    ).toThrow(StripePayloadError)

    const item = subscription().items.data[0]
    expect(() =>
      requireSingleRecurringSubscriptionItem(
        subscription({ items: { data: [item, { ...item, id: 'si_b' }] } })
      )
    ).toThrow(StripePayloadError)
  })

  test('extracts only an expanded invoice confirmation secret', () => {
    expect(
      requireSubscriptionClientSecret({
        latest_invoice: {
          confirmation_secret: { client_secret: 'pi_secret_a' },
          id: 'in_a',
          object: 'invoice',
        },
      })
    ).toBe('pi_secret_a')

    for (const latest_invoice of [
      null,
      'in_a',
      { id: 'in_a', object: 'invoice' as const },
      { deleted: true, id: 'in_a', object: 'invoice' as const },
    ]) {
      expect(() => requireSubscriptionClientSecret({ latest_invoice })).toThrow(
        StripePayloadError
      )
    }
  })

  test('selects only subscription lifecycle events with subscription objects', () => {
    const value = subscription()
    for (const type of [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]) {
      expect(
        selectSubscriptionLifecycleEvent({ data: { object: value }, type })
      ).toEqual({ subscription: value, type })
    }

    for (const event of [
      { data: { object: value }, type: 'product.created' },
      {
        data: { object: { id: 'prod_a', object: 'product' } },
        type: 'customer.subscription.created',
      },
      {
        data: { object: { ...value, customer: 42 } },
        type: 'customer.subscription.created',
      },
      {
        data: {
          object: {
            ...value,
            items: { data: [{ ...value.items.data[0], price: null }] },
          },
        },
        type: 'customer.subscription.created',
      },
    ]) {
      expect(selectSubscriptionLifecycleEvent(event)).toBeNull()
    }
  })
})
