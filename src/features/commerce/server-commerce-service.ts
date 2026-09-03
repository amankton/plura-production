import 'server-only'

import { db } from '@/lib/db'
import { getTenantContext } from '@/lib/auth/server-tenant-context'
import { getStripeServerClient } from '@/lib/stripe'
import {
  createCommerceService,
  type CommerceFees,
  type CommerceProvider,
  type CommerceStore,
} from './commerce-service'

const commerceStore: CommerceStore = {
  findFunnelCheckoutTarget: async (funnelId) => {
    const funnel = await db.funnel.findUnique({
      where: { id: funnelId },
      select: {
        id: true,
        liveProducts: true,
        published: true,
        subAccountId: true,
        SubAccount: { select: { connectAccountId: true } },
      },
    })
    if (!funnel) return null
    return {
      connectedAccountId: funnel.SubAccount.connectAccountId ?? '',
      funnelId: funnel.id,
      liveProducts: funnel.liveProducts ?? '[]',
      published: funnel.published,
      subaccountId: funnel.subAccountId,
    }
  },
  findSubaccountCommerceTarget: async (subaccountId) => {
    const subaccount = await db.subAccount.findUnique({
      where: { id: subaccountId },
      select: { connectAccountId: true, id: true },
    })
    return subaccount
      ? {
          connectedAccountId: subaccount.connectAccountId ?? '',
          subaccountId: subaccount.id,
        }
      : null
  },
  updateFunnelProducts: async ({
    funnelId,
    serializedSelections,
    subaccountId,
  }) => {
    const result = await db.funnel.updateMany({
      where: { id: funnelId, subAccountId: subaccountId },
      data: { liveProducts: serializedSelections },
    })
    return result.count === 1
  },
}

const commerceProvider: CommerceProvider = {
  createCheckoutSession: async ({
    connectedAccountId,
    fees,
    idempotencyKey,
    integrationIdentifier,
    mode,
    priceIds,
  }) => {
    const session = await getStripeServerClient().checkout.sessions.create(
      {
        integration_identifier: integrationIdentifier,
        line_items: priceIds.map((price) => ({ price, quantity: 1 })),
        ...(mode === 'subscription'
          ? {
              subscription_data: {
                application_fee_percent: fees.subscriptionPercent,
                metadata: { connectAccountSubscriptions: 'true' },
              },
            }
          : {
              payment_intent_data: {
                application_fee_amount: fees.oneTimeFeeAmount,
                metadata: { connectAccountPayments: 'true' },
              },
            }),
        mode,
        redirect_on_completion: 'never',
        ui_mode: 'embedded',
      },
      { idempotencyKey, stripeAccount: connectedAccountId }
    )
    if (!session.client_secret) {
      throw new Error('Stripe Checkout did not return a client secret')
    }
    return { clientSecret: session.client_secret }
  },
  listProducts: (connectedAccountId) =>
    getStripeServerClient().products
      .list(
        { active: true, expand: ['data.default_price'], limit: 100 },
        { stripeAccount: connectedAccountId }
      )
      .then(({ data }) => data),
  retrievePrices: (connectedAccountId, priceIds) =>
    Promise.all(
      priceIds.map(async (priceId) => {
        const price = await getStripeServerClient().prices.retrieve(
          priceId,
          {},
          { stripeAccount: connectedAccountId }
        )
        return {
          active: price.active,
          currency: price.currency,
          id: price.id,
          recurring: Boolean(price.recurring),
        }
      })
    ),
}

const requiredNumber = (value: string | undefined) =>
  value?.trim() ? Number(value) : Number.NaN

const getFees = (): CommerceFees => ({
  oneTimeFeeAmount: requiredNumber(
    process.env.STRIPE_PLATFORM_ONETIME_FEE_CENTS
  ),
  subscriptionPercent: requiredNumber(
    process.env.STRIPE_PLATFORM_SUBSCRIPTION_PERCENT
  ),
})

export const commerceService = createCommerceService({
  getFees,
  provider: commerceProvider,
  resolveContext: getTenantContext,
  store: commerceStore,
})
