import 'server-only'

import type Stripe from 'stripe'
import { getStripeServerClient } from '.'
import {
  crewframeBillingPlans,
  crewframePriceLookupKeys,
  isCrewframePlan,
  resolveCrewframePlan,
  type CrewframePlan,
  type CrewframePrice,
  type CrewframePriceOption,
} from './billing-catalog'

const getExpectedLivemode = () => {
  const mode = process.env.STRIPE_CATALOG_MODE
  if (mode === 'test') return false
  if (mode === 'live') return true
  throw new Error('STRIPE_CATALOG_MODE must be either test or live')
}

const loadCrewframeCatalog = async () => {
  const expectedLivemode = getExpectedLivemode()
  const response = await getStripeServerClient().prices.list({
    active: true,
    expand: ['data.product'],
    limit: 10,
    lookup_keys: crewframePriceLookupKeys,
    type: 'recurring',
  })

  const byPlan = new Map<CrewframePlan, Stripe.Price>()
  const productIds = new Set<string>()
  for (const price of response.data) {
    const product = price.product
    if (
      typeof product === 'string' ||
      'deleted' in product ||
      !product.active ||
      productIds.has(product.id)
    ) {
      throw new Error('Crewframe plans must use distinct active Stripe products')
    }
    const plan = resolveCrewframePlan(price, expectedLivemode)
    if (!plan || byPlan.has(plan)) {
      throw new Error('Stripe returned an invalid Crewframe billing catalog')
    }
    productIds.add(product.id)
    byPlan.set(plan, price)
  }

  return crewframeBillingPlans.map((definition) => {
    const { plan } = definition
    const price = byPlan.get(plan)
    if (!price) throw new Error(`Stripe catalog is missing ${plan}`)
    return { definition, price }
  })
}

export const getCrewframePriceOptions = async (): Promise<
  CrewframePriceOption[]
> =>
  (await loadCrewframeCatalog()).map(({ definition }) => ({
    interval: definition.interval,
    plan: definition.plan,
    unitAmount: definition.unitAmount,
  }))

export const getCrewframePriceForPlan = async (value: unknown) => {
  if (!isCrewframePlan(value)) return null
  const entry = (await loadCrewframeCatalog()).find(
    ({ definition }) => definition.plan === value
  )
  return entry?.price ?? null
}

export const resolveEnvironmentCrewframePlan = (price: CrewframePrice) =>
  resolveCrewframePlan(price, getExpectedLivemode())
