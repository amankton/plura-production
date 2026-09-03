import { z } from 'zod'
import { AccessError } from '@/lib/auth/access-error'
import {
  assertAgencyOwner,
  type AgencyContext,
} from '@/lib/auth/agency-context'
import type { CrewframePlan } from '@/lib/stripe/billing-catalog'

const resourceIdSchema = z.string().trim().min(1).max(128)
const operationIdSchema = z.string().uuid()
const customerIdSchema = z.string().regex(/^cus_[A-Za-z0-9]+$/).max(128)
const subscriptionIdSchema = z.string().regex(/^sub_[A-Za-z0-9]+$/).max(128)

const requireStoredProviderId = (schema: z.ZodString, value: string) => {
  const result = schema.safeParse(value)
  if (!result.success) throw new AccessError('CONFLICT')
  return result.data
}

const ensureCustomerSchema = z
  .object({
    agencyId: resourceIdSchema,
    operationId: operationIdSchema,
  })
  .strict()

const subscriptionSchema = ensureCustomerSchema
  .extend({
    plan: z.enum(['BASIC', 'UNLIMITED']),
  })
  .strict()
const billingReadSchema = z.object({ agencyId: resourceIdSchema }).strict()

export type AgencyBillingProfile = {
  address: string
  city: string
  companyEmail: string
  country: string
  customerId: string
  id: string
  name: string
  state: string
  subscription: {
    active: boolean
    customerId: string
    subscriptionId: string
  } | null
  zipCode: string
}

export type BillingCustomer = {
  agencyId: string | null
  deleted: boolean
  email: string | null
  id: string
}

export type BillingCharge = {
  amount: number
  created: number
  description: string | null
  id: string
}

export type BillingStore = {
  attachCustomer: (
    agencyId: string,
    customerId: string
  ) => Promise<boolean>
  findAgencyBillingProfile: (
    agencyId: string
  ) => Promise<AgencyBillingProfile | null>
}

export type BillingProvider = {
  bindCustomer: (
    customerId: string,
    agencyId: string,
    idempotencyKey: string
  ) => Promise<void>
  createCustomer: (
    profile: AgencyBillingProfile,
    idempotencyKey: string
  ) => Promise<{ id: string }>
  createSubscription: (values: {
    customerId: string
    idempotencyKey: string
    plan: CrewframePlan
  }) => Promise<{ clientSecret: string }>
  getCustomer: (customerId: string) => Promise<BillingCustomer>
  listCharges: (customerId: string) => Promise<BillingCharge[]>
  updateSubscription: (values: {
    customerId: string
    idempotencyKey: string
    plan: CrewframePlan
    subscriptionId: string
  }) => Promise<{ clientSecret: string }>
}

type BillingServiceDependencies = {
  provider: BillingProvider
  resolveContext: (agencyId: string) => Promise<AgencyContext>
  store: BillingStore
}

const customerIdempotencyKey = (agencyId: string, operationId: string) =>
  `crewframe:agency-customer:${agencyId}:${operationId}`

const subscriptionIdempotencyKey = (
  agencyId: string,
  plan: CrewframePlan,
  operationId: string
) => `crewframe:agency-subscription:${agencyId}:${plan}:${operationId}`

const requireProfile = async (
  store: BillingStore,
  agencyId: string
): Promise<AgencyBillingProfile> => {
  const profile = await store.findAgencyBillingProfile(agencyId)
  if (!profile) throw new AccessError('RESOURCE_NOT_FOUND')
  if (
    profile.id !== agencyId ||
    !z.string().email().safeParse(profile.companyEmail).success
  ) {
    throw new AccessError('CONFLICT')
  }
  if (profile.customerId) {
    requireStoredProviderId(customerIdSchema, profile.customerId)
  }
  if (profile.subscription) {
    requireStoredProviderId(customerIdSchema, profile.subscription.customerId)
    requireStoredProviderId(
      subscriptionIdSchema,
      profile.subscription.subscriptionId
    )
  }
  return profile
}

const validateCustomerBinding = (
  customer: BillingCustomer,
  profile: AgencyBillingProfile
) => {
  if (customer.deleted || customer.id !== profile.customerId) {
    throw new AccessError('CONFLICT')
  }
  if (customer.agencyId !== profile.id) {
    throw new AccessError('CONFLICT')
  }
}

export const createBillingService = ({
  provider,
  resolveContext,
  store,
}: BillingServiceDependencies) => ({
  listAgencyCharges: async (rawInput: unknown) => {
    const input = billingReadSchema.parse(rawInput)
    const context = await resolveContext(input.agencyId)
    assertAgencyOwner(context)
    const profile = await requireProfile(store, context.agencyId)
    if (!profile.customerId) return []

    const customer = await provider.getCustomer(profile.customerId)
    validateCustomerBinding(customer, profile)
    return provider.listCharges(profile.customerId)
  },

  ensureAgencyCustomer: async (rawInput: unknown) => {
    const input = ensureCustomerSchema.parse(rawInput)
    const context = await resolveContext(input.agencyId)
    assertAgencyOwner(context)
    const profile = await requireProfile(store, context.agencyId)
    const idempotencyKey = customerIdempotencyKey(
      context.agencyId,
      input.operationId
    )

    if (profile.customerId) {
      const customer = await provider.getCustomer(profile.customerId)
      if (customer.deleted || customer.id !== profile.customerId) {
        throw new AccessError('CONFLICT')
      }
      if (customer.agencyId === profile.id) return { ready: true as const }
      if (
        customer.agencyId ||
        customer.email?.trim().toLowerCase() !==
          profile.companyEmail.trim().toLowerCase()
      ) {
        throw new AccessError('CONFLICT')
      }
      await provider.bindCustomer(
        customer.id,
        profile.id,
        `${idempotencyKey}:bind`
      )
      return { ready: true as const }
    }

    const customer = await provider.createCustomer(profile, idempotencyKey)
    if (!(await store.attachCustomer(profile.id, customer.id))) {
      const current = await requireProfile(store, profile.id)
      if (current.customerId !== customer.id) throw new AccessError('CONFLICT')
    }
    return { ready: true as const }
  },

  createOrChangeSubscription: async (rawInput: unknown) => {
    const input = subscriptionSchema.parse(rawInput)
    const context = await resolveContext(input.agencyId)
    assertAgencyOwner(context)
    const profile = await requireProfile(store, context.agencyId)
    if (!profile.customerId) throw new AccessError('CONFLICT')

    const customer = await provider.getCustomer(profile.customerId)
    validateCustomerBinding(customer, profile)
    const idempotencyKey = subscriptionIdempotencyKey(
      profile.id,
      input.plan,
      input.operationId
    )

    if (profile.subscription?.active) {
      if (profile.subscription.customerId !== profile.customerId) {
        throw new AccessError('CONFLICT')
      }
      return provider.updateSubscription({
        customerId: profile.customerId,
        idempotencyKey,
        plan: input.plan,
        subscriptionId: profile.subscription.subscriptionId,
      })
    }

    return provider.createSubscription({
      customerId: profile.customerId,
      idempotencyKey,
      plan: input.plan,
    })
  },
})
