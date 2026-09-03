import 'server-only'

import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { getStripeServerClient } from '@/lib/stripe'
import { getCrewframePriceForPlan } from '@/lib/stripe/billing-catalog-server'
import {
  requireSingleRecurringSubscriptionItem,
  requireSubscriptionClientSecret,
} from '@/lib/stripe/stripe-normalizers'
import { getAgencyContext } from '@/lib/auth/server-agency-context'
import { AccessError } from '@/lib/auth/access-error'
import {
  createBillingService,
  type BillingProvider,
  type BillingStore,
} from './billing-service'

const stripeReferenceId = (value: string | Stripe.Customer | Stripe.DeletedCustomer) =>
  typeof value === 'string' ? value : value.id

const billingStore: BillingStore = {
  attachCustomer: async (agencyId, customerId) => {
    const result = await db.agency.updateMany({
      where: { customerId: '', id: agencyId },
      data: { customerId },
    })
    return result.count === 1
  },
  findAgencyBillingProfile: async (agencyId) => {
    const agency = await db.agency.findUnique({
      where: { id: agencyId },
      select: {
        address: true,
        city: true,
        companyEmail: true,
        country: true,
        customerId: true,
        id: true,
        name: true,
        state: true,
        Subscription: {
          select: {
            active: true,
            customerId: true,
            subscritiptionId: true,
          },
        },
        zipCode: true,
      },
    })
    if (!agency) return null
    return {
      ...agency,
      subscription: agency.Subscription
        ? {
            active: agency.Subscription.active,
            customerId: agency.Subscription.customerId,
            subscriptionId: agency.Subscription.subscritiptionId,
          }
        : null,
    }
  },
}

const getPriceId = async (plan: 'BASIC' | 'UNLIMITED') => {
  const price = await getCrewframePriceForPlan(plan)
  if (!price) throw new Error('Stripe catalog plan is unavailable')
  return price.id
}

const billingProvider: BillingProvider = {
  bindCustomer: async (customerId, agencyId, idempotencyKey) => {
    await getStripeServerClient().customers.update(
      customerId,
      { metadata: { crewframeAgencyId: agencyId } },
      { idempotencyKey }
    )
  },
  createCustomer: async (profile, idempotencyKey) => {
    const customer = await getStripeServerClient().customers.create(
      {
        address: {
          city: profile.city,
          country: profile.country,
          line1: profile.address,
          postal_code: profile.zipCode,
          state: profile.state,
        },
        email: profile.companyEmail,
        metadata: { crewframeAgencyId: profile.id },
        name: profile.name,
        shipping: {
          address: {
            city: profile.city,
            country: profile.country,
            line1: profile.address,
            postal_code: profile.zipCode,
            state: profile.state,
          },
          name: profile.name,
        },
      },
      { idempotencyKey }
    )
    return { id: customer.id }
  },
  createSubscription: async ({ customerId, idempotencyKey, plan }) => {
    const subscription = await getStripeServerClient().subscriptions.create(
      {
        customer: customerId,
        expand: ['latest_invoice.confirmation_secret'],
        items: [{ price: await getPriceId(plan) }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
      },
      { idempotencyKey }
    )
    return { clientSecret: requireSubscriptionClientSecret(subscription) }
  },
  getCustomer: async (customerId) => {
    const customer = await getStripeServerClient().customers.retrieve(customerId)
    if (customer.deleted === true) {
      return {
        agencyId: null,
        deleted: true,
        email: null,
        id: customer.id,
      }
    }
    return {
      agencyId: customer.metadata.crewframeAgencyId || null,
      deleted: false,
      email: customer.email,
      id: customer.id,
    }
  },
  listCharges: async (customerId) => {
    const charges = await getStripeServerClient().charges.list({
      customer: customerId,
      limit: 50,
    })
    return charges.data.map(({ amount, created, description, id }) => ({
      amount,
      created,
      description,
      id,
    }))
  },
  updateSubscription: async ({
    customerId,
    idempotencyKey,
    plan,
    subscriptionId,
  }) => {
    const stripe = getStripeServerClient()
    const current = await stripe.subscriptions.retrieve(subscriptionId)
    if (stripeReferenceId(current.customer) !== customerId) {
      throw new AccessError('CONFLICT')
    }
    const currentItem = requireSingleRecurringSubscriptionItem(current)
    const subscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        expand: ['latest_invoice.confirmation_secret'],
        items: [
          { deleted: true, id: currentItem.itemId },
          { price: await getPriceId(plan) },
        ],
      },
      { idempotencyKey }
    )
    return { clientSecret: requireSubscriptionClientSecret(subscription) }
  },
}

export const billingService = createBillingService({
  provider: billingProvider,
  resolveContext: getAgencyContext,
  store: billingStore,
})
