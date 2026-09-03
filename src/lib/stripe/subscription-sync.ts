import 'server-only'

import { Plan } from '@prisma/client'
import { db } from '../db'
import {
  normalizeStripeSubscription,
  type StripeSubscriptionInput,
} from './stripe-normalizers'
import { resolveEnvironmentCrewframePlan } from './billing-catalog-server'

export const synchronizeSubscription = async (
  subscription: StripeSubscriptionInput
) => {
  const normalized = normalizeStripeSubscription(subscription)
  const logicalPlan = resolveEnvironmentCrewframePlan(normalized.price)
  if (!logicalPlan) {
    throw new Error('Subscription price is not a Crewframe plan')
  }

  const agency = await db.agency.findFirst({
    where: { customerId: normalized.customerId },
    select: { id: true },
  })
  if (!agency) {
    throw new Error('Subscription customer is not bound to an agency')
  }

  const data = {
    active: normalized.active,
    agencyId: agency.id,
    customerId: normalized.customerId,
    currentPeriodEndDate: new Date(normalized.currentPeriodEnd * 1000),
    logicalPlan: logicalPlan === 'BASIC' ? Plan.BASIC : Plan.UNLIMITED,
    priceId: normalized.priceId,
    subscritiptionId: normalized.subscriptionId,
  }

  return db.subscription.upsert({
    where: { agencyId: agency.id },
    create: data,
    update: data,
  })
}
