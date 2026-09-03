import {
  resolveLegacyCrewframePlan,
  type CrewframePlan,
} from './billing-catalog'

export type LegacySubscriptionRecord = {
  active: boolean
  id: string
  plan: string | null
  priceId: string
}

export type SubscriptionPlanMigrationReport = {
  conflicts: Array<{
    currentPricePlan: CrewframePlan
    legacyPlan: CrewframePlan
    subscriptionRef: string
  }>
  counts: {
    conflicts: number
    mappable: number
    nullLegacyPlan: number
    subscriptions: number
    unknownLegacyPlan: number
    unverifiedProviderPrice: number
  }
  mappable: Array<{
    logicalPlan: CrewframePlan
    subscriptionRef: string
  }>
  nullLegacyPlan: Array<{ subscriptionRef: string }>
  unknownLegacyPlan: Array<{ subscriptionRef: string }>
  unverifiedProviderPrice: Array<{ subscriptionRef: string }>
}

export const analyzeSubscriptionPlanMigration = (
  subscriptions: readonly LegacySubscriptionRecord[]
): SubscriptionPlanMigrationReport => {
  const conflicts: SubscriptionPlanMigrationReport['conflicts'] = []
  const mappable: SubscriptionPlanMigrationReport['mappable'] = []
  const nullLegacyPlan: SubscriptionPlanMigrationReport['nullLegacyPlan'] = []
  const unknownLegacyPlan: SubscriptionPlanMigrationReport['unknownLegacyPlan'] =
    []
  const unverifiedProviderPrice: SubscriptionPlanMigrationReport['unverifiedProviderPrice'] =
    []

  for (const subscription of subscriptions) {
    if (!subscription.plan) {
      nullLegacyPlan.push({ subscriptionRef: subscription.id })
      continue
    }

    const legacyPlan = resolveLegacyCrewframePlan(subscription.plan)
    if (!legacyPlan) {
      unknownLegacyPlan.push({ subscriptionRef: subscription.id })
      continue
    }

    const currentPricePlan = resolveLegacyCrewframePlan(subscription.priceId)
    if (currentPricePlan && currentPricePlan !== legacyPlan) {
      conflicts.push({
        currentPricePlan,
        legacyPlan,
        subscriptionRef: subscription.id,
      })
      continue
    }
    if (!currentPricePlan && subscription.active) {
      unverifiedProviderPrice.push({ subscriptionRef: subscription.id })
    }
    mappable.push({ logicalPlan: legacyPlan, subscriptionRef: subscription.id })
  }

  return {
    conflicts,
    counts: {
      conflicts: conflicts.length,
      mappable: mappable.length,
      nullLegacyPlan: nullLegacyPlan.length,
      subscriptions: subscriptions.length,
      unknownLegacyPlan: unknownLegacyPlan.length,
      unverifiedProviderPrice: unverifiedProviderPrice.length,
    },
    mappable,
    nullLegacyPlan,
    unknownLegacyPlan,
    unverifiedProviderPrice,
  }
}
