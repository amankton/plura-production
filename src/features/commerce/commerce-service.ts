import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import { z } from 'zod'
import { AccessError } from '@/lib/auth/access-error'
import { assertTenantAction } from '@/lib/auth/policy'
import type { TenantContext } from '@/lib/auth/tenant-context'

const resourceIdSchema = z.string().trim().min(1).max(128)
const operationIdSchema = z.string().uuid()
const connectedAccountIdSchema = z
  .string()
  .regex(/^acct_[A-Za-z0-9]+$/)
  .max(128)
const storedPriceSelectionSchema = z
  .object({
    productId: z.string().trim().regex(/^price_[A-Za-z0-9]+$/).max(128),
    recurring: z.boolean(),
  })
  .strict()
const checkoutInputSchema = z
  .object({
    funnelId: resourceIdSchema,
    operationId: operationIdSchema,
  })
  .strict()

const storedPriceSchema = z
  .array(storedPriceSelectionSchema)
  .min(1)
  .max(20)
const configureProductsSchema = z
  .object({
    funnelId: resourceIdSchema,
    selections: z.array(storedPriceSelectionSchema).max(20),
  })
  .strict()

const feesSchema = z.object({
  oneTimeFeeAmount: z.number().int().min(0).max(100_000_000),
  subscriptionPercent: z.number().min(0).max(100),
})

const requireConnectedAccountId = (value: string) => {
  const result = connectedAccountIdSchema.safeParse(value)
  if (!result.success) throw new AccessError('CONFLICT')
  return result.data
}

export type CommerceFees = z.infer<typeof feesSchema>

export type CommercePrice = {
  active: boolean
  currency: string
  id: string
  recurring: boolean
}

export type CommerceStore = {
  findFunnelCheckoutTarget: (funnelId: string) => Promise<{
    connectedAccountId: string
    funnelId: string
    liveProducts: string
    published: boolean
    subaccountId: string
  } | null>
  findSubaccountCommerceTarget: (subaccountId: string) => Promise<{
    connectedAccountId: string
    subaccountId: string
  } | null>
  updateFunnelProducts: (values: {
    funnelId: string
    serializedSelections: string
    subaccountId: string
  }) => Promise<boolean>
}

export type ConfigureFunnelProductsInput = z.infer<
  typeof configureProductsSchema
>

export type CommerceProvider = {
  createCheckoutSession: (values: {
    connectedAccountId: string
    fees: CommerceFees
    idempotencyKey: string
    integrationIdentifier: string
    mode: 'payment' | 'subscription'
    priceIds: string[]
  }) => Promise<{ clientSecret: string }>
  listProducts: (connectedAccountId: string) => Promise<Stripe.Product[]>
  retrievePrices: (
    connectedAccountId: string,
    priceIds: string[]
  ) => Promise<CommercePrice[]>
}

type CommerceServiceDependencies = {
  getFees: () => CommerceFees
  provider: CommerceProvider
  resolveContext: (subaccountId: string) => Promise<TenantContext>
  store: CommerceStore
}

const parseStoredPrices = (serialized: string) => {
  try {
    return storedPriceSchema.parse(JSON.parse(serialized))
  } catch {
    throw new AccessError('CONFLICT')
  }
}

const requireUniqueSelections = (
  selections: z.infer<typeof storedPriceSelectionSchema>[]
) => {
  const ids = selections.map(({ productId }) => productId)
  if (new Set(ids).size !== ids.length) throw new AccessError('CONFLICT')
  return ids
}

const verifySelections = async (
  provider: CommerceProvider,
  connectedAccountId: string,
  selections: z.infer<typeof storedPriceSelectionSchema>[]
) => {
  const priceIds = requireUniqueSelections(selections)
  if (priceIds.length === 0) return priceIds
  const prices = await provider.retrievePrices(connectedAccountId, priceIds)
  if (prices.length !== priceIds.length) throw new AccessError('CONFLICT')

  const byId = new Map(prices.map((price) => [price.id, price]))
  const verifiedPrices = selections.map((selection) => {
    const price = byId.get(selection.productId)
    if (
      !price ||
      !price.active ||
      price.currency.toLowerCase() !== 'usd' ||
      price.recurring !== selection.recurring
    ) {
      throw new AccessError('CONFLICT')
    }
    return price
  })
  if (byId.size !== verifiedPrices.length) throw new AccessError('CONFLICT')

  const recurringModes = new Set(
    verifiedPrices.map(({ recurring }) => recurring)
  )
  if (recurringModes.size !== 1) throw new AccessError('CONFLICT')
  return priceIds
}

export const integrationIdentifierFromOperationId = (operationId: string) => {
  const digest = createHash('sha256').update(operationId).digest()
  const suffix = Array.from(digest.subarray(0, 8), (value) =>
    String.fromCharCode(97 + (value % 26))
  ).join('')
  return `crewframe_funnel_checkout_v1_${suffix}`
}

export const createCommerceService = ({
  getFees,
  provider,
  resolveContext,
  store,
}: CommerceServiceDependencies) => ({
  createAuthenticatedFunnelCheckout: async (rawInput: unknown) => {
    const input = checkoutInputSchema.parse(rawInput)
    const target = await store.findFunnelCheckoutTarget(input.funnelId)
    if (!target || !target.published) throw new AccessError('FORBIDDEN')

    const context = await resolveContext(target.subaccountId)
    assertTenantAction(context, 'commerce:checkout')
    if (context.subaccountId !== target.subaccountId) {
      throw new AccessError('CONFLICT')
    }
    const connectedAccountId = requireConnectedAccountId(
      target.connectedAccountId
    )

    const selections = parseStoredPrices(target.liveProducts)
    const priceIds = await verifySelections(
      provider,
      connectedAccountId,
      selections
    )
    const mode = selections[0].recurring ? 'subscription' : 'payment'
    const fees = feesSchema.parse(getFees())
    const result = await provider.createCheckoutSession({
      connectedAccountId,
      fees,
      idempotencyKey: `crewframe:funnel-checkout:${target.funnelId}:${input.operationId}`,
      integrationIdentifier: integrationIdentifierFromOperationId(
        input.operationId
      ),
      mode,
      priceIds,
    })
    return {
      clientSecret: result.clientSecret,
      connectedAccountId,
    }
  },

  configureFunnelProducts: async (rawInput: unknown) => {
    const input = configureProductsSchema.parse(rawInput)
    const target = await store.findFunnelCheckoutTarget(input.funnelId)
    if (!target || target.funnelId !== input.funnelId) {
      throw new AccessError('RESOURCE_NOT_FOUND')
    }

    const context = await resolveContext(target.subaccountId)
    assertTenantAction(context, 'commerce:configure')
    if (context.subaccountId !== target.subaccountId) {
      throw new AccessError('CONFLICT')
    }
    const connectedAccountId = requireConnectedAccountId(
      target.connectedAccountId
    )
    await verifySelections(provider, connectedAccountId, input.selections)
    const updated = await store.updateFunnelProducts({
      funnelId: target.funnelId,
      serializedSelections: JSON.stringify(input.selections),
      subaccountId: context.subaccountId,
    })
    if (!updated) throw new AccessError('CONFLICT')
    return {
      funnelId: target.funnelId,
      subaccountId: context.subaccountId,
    }
  },

  listConnectedProducts: async (rawSubaccountId: unknown) => {
    const subaccountId = resourceIdSchema.parse(rawSubaccountId)
    const context = await resolveContext(subaccountId)
    assertTenantAction(context, 'commerce:catalog')
    const target = await store.findSubaccountCommerceTarget(context.subaccountId)
    if (!target) throw new AccessError('RESOURCE_NOT_FOUND')
    if (target.subaccountId !== context.subaccountId) {
      throw new AccessError('CONFLICT')
    }
    if (!target.connectedAccountId.trim()) return []
    return provider.listProducts(requireConnectedAccountId(target.connectedAccountId))
  },
})
