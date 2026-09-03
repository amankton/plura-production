'use server'
import { Plan } from '@prisma/client'
import { db } from '../db'
import { getStripeServerClient } from '.'
import {
  normalizeStripeSubscription,
  type StripeSubscriptionInput,
} from './stripe-normalizers'

const isCrewframePlan = (priceId: string): priceId is Plan =>
  Object.values(Plan).some((plan) => plan === priceId)

export const subscriptionCreated = async (
  subscription: StripeSubscriptionInput
) => {
  try {
    const normalized = normalizeStripeSubscription(subscription)
    if (!isCrewframePlan(normalized.priceId)) {
      throw new Error('Subscription price is not a Crewframe plan')
    }

    const agency = await db.agency.findFirst({
      where: {
        customerId: normalized.customerId,
      },
      include: {
        SubAccount: true,
      },
    })
    if (!agency) {
      throw new Error('Could not find and agency to upsert the subscription')
    }

    const data = {
      active: normalized.active,
      agencyId: agency.id,
      customerId: normalized.customerId,
      currentPeriodEndDate: new Date(normalized.currentPeriodEnd * 1000),
      priceId: normalized.priceId,
      subscritiptionId: normalized.subscriptionId,
      plan: normalized.priceId,
    }

    const res = await db.subscription.upsert({
      where: {
        agencyId: agency.id,
      },
      create: data,
      update: data,
    })
    console.log(`🟢 Synchronized Subscription for ${normalized.subscriptionId}`)
  } catch (error) {
    console.log('🔴 Error from Create action', error)
  }
}

export const getConnectAccountProducts = async (stripeAccount: string) => {
  const stripe = getStripeServerClient()
  const products = await stripe.products.list(
    {
      limit: 50,
      expand: ['data.default_price'],
    },
    {
      stripeAccount,
    }
  )
  return products.data
}
