export const crewframeBillingPlans = [
  {
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    lookupKey: 'crewframe_basic_monthly',
    plan: 'BASIC',
    unitAmount: 4_900,
  },
  {
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    lookupKey: 'crewframe_unlimited_monthly',
    plan: 'UNLIMITED',
    unitAmount: 19_900,
  },
] as const

export type CrewframePlan = (typeof crewframeBillingPlans)[number]['plan']

export type CrewframePrice = {
  active: boolean
  currency: string
  livemode: boolean
  lookup_key: string | null
  recurring: {
    interval: string
    interval_count: number
    usage_type: string
  } | null
  unit_amount: number | null
}

export const crewframePriceLookupKeys = crewframeBillingPlans.map(
  ({ lookupKey }) => lookupKey
)

export const resolveCrewframePlan = (
  price: CrewframePrice,
  expectedLivemode: boolean
): CrewframePlan | null => {
  const match = crewframeBillingPlans.find(
    (plan) =>
      price.active &&
      price.livemode === expectedLivemode &&
      price.currency === plan.currency &&
      price.lookup_key === plan.lookupKey &&
      price.recurring?.interval === plan.interval &&
      price.recurring.interval_count === plan.intervalCount &&
      price.recurring.usage_type === 'licensed' &&
      price.unit_amount === plan.unitAmount
  )
  return match?.plan ?? null
}

export const isCrewframePlan = (value: unknown): value is CrewframePlan =>
  crewframeBillingPlans.some(({ plan }) => plan === value)

export const resolveLegacyCrewframePlan = (
  value: string | null | undefined
): CrewframePlan | null => {
  if (value === 'price_1OYxkqFj9oKEERu1NbKUxXxN') return 'BASIC'
  if (value === 'price_1OYxkqFj9oKEERu1KfJGWxgN') return 'UNLIMITED'
  return null
}

export type CrewframePriceOption = {
  interval: 'month'
  plan: CrewframePlan
  unitAmount: number
}
