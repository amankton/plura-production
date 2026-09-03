import { describe, expect, test } from 'bun:test'
import { Role } from '@prisma/client'
import { ZodError } from 'zod'
import type { TenantContext } from '../../src/lib/auth/tenant-context'
import { AccessError } from '../../src/lib/auth/access-error'
import {
  createCommerceService,
  integrationIdentifierFromOperationId,
  type CommercePrice,
  type CommerceProvider,
  type CommerceStore,
} from '../../src/features/commerce/commerce-service'

const operationId = '18ffdbbf-a9c7-4bd0-9200-f637f7b52932'

const context = (role: Role = Role.AGENCY_OWNER): TenantContext => ({
  actor: { id: 'user-a', providerSubject: 'user-a', role },
  agencyId: 'agency-a',
  correlationId: 'correlation-a',
  scope: { subaccountIds: ['sub-a'] },
  subaccountId: 'sub-a',
})

const defaultTarget = {
  connectedAccountId: 'acct_connecteda',
  funnelId: 'funnel-a',
  liveProducts: JSON.stringify([
    { productId: 'price_a', recurring: true },
    { productId: 'price_b', recurring: true },
  ]),
  published: true,
  subaccountId: 'sub-a',
}

const defaultPrices: CommercePrice[] = [
  { active: true, currency: 'usd', id: 'price_a', recurring: true },
  { active: true, currency: 'usd', id: 'price_b', recurring: true },
]

const harness = (values: {
  fees?: { oneTimeFeeAmount: number; subscriptionPercent: number }
  prices?: CommercePrice[]
  role?: Role
  target?: typeof defaultTarget | null
  updateResult?: boolean
} = {}) => {
  const calls: Array<{ method: string; values?: unknown }> = []
  const store: CommerceStore = {
    findFunnelCheckoutTarget: async (funnelId) => {
      calls.push({ method: 'findFunnel', values: funnelId })
      return values.target === undefined ? defaultTarget : values.target
    },
    findSubaccountCommerceTarget: async (subaccountId) => {
      calls.push({ method: 'findSubaccount', values: subaccountId })
      return {
        connectedAccountId: 'acct_connecteda',
        subaccountId: 'sub-a',
      }
    },
    updateFunnelProducts: async (input) => {
      calls.push({ method: 'updateFunnelProducts', values: input })
      return values.updateResult ?? true
    },
  }
  const provider: CommerceProvider = {
    createCheckoutSession: async (input) => {
      calls.push({ method: 'createCheckout', values: input })
      return { clientSecret: 'checkout-secret' }
    },
    listProducts: async (connectedAccountId) => {
      calls.push({ method: 'listProducts', values: connectedAccountId })
      return []
    },
    retrievePrices: async (connectedAccountId, priceIds) => {
      calls.push({
        method: 'retrievePrices',
        values: { connectedAccountId, priceIds },
      })
      return values.prices ?? defaultPrices
    },
  }
  const service = createCommerceService({
    getFees: () =>
      values.fees ?? { oneTimeFeeAmount: 200, subscriptionPercent: 1 },
    provider,
    resolveContext: async (subaccountId) => {
      calls.push({ method: 'resolveContext', values: subaccountId })
      return context(values.role)
    },
    store,
  })
  return { calls, service }
}

describe('connected commerce authority', () => {
  test('rejects browser provider selectors and fees before any read or mutation', async () => {
    const { calls, service } = harness()
    await expect(
      service.createAuthenticatedFunnelCheckout({
        connectedAccountId: 'acct_injected',
        fees: { subscriptionPercent: 100 },
        funnelId: 'funnel-a',
        operationId,
        prices: ['price_injected'],
      })
    ).rejects.toBeInstanceOf(ZodError)
    expect(calls).toEqual([])
  })

  test.each([Role.AGENCY_OWNER, Role.AGENCY_ADMIN, Role.SUBACCOUNT_USER])(
    'allows authorized %s to list a server-derived connected catalog',
    async (role) => {
      const { calls, service } = harness({ role })
      await service.listConnectedProducts('sub-a')
      expect(calls).toEqual([
        { method: 'resolveContext', values: 'sub-a' },
        { method: 'findSubaccount', values: 'sub-a' },
        { method: 'listProducts', values: 'acct_connecteda' },
      ])
    }
  )

  test('denies guests before connected-account lookup or Stripe', async () => {
    const { calls, service } = harness({ role: Role.SUBACCOUNT_GUEST })
    await expect(service.listConnectedProducts('sub-a')).rejects.toBeInstanceOf(
      AccessError
    )
    expect(calls.map(({ method }) => method)).toEqual(['resolveContext'])
  })

  test('creates checkout from the stored funnel, prices, account, and fees', async () => {
    const { calls, service } = harness()
    await expect(
      service.createAuthenticatedFunnelCheckout({
        funnelId: 'funnel-a',
        operationId,
      })
    ).resolves.toEqual({
      clientSecret: 'checkout-secret',
      connectedAccountId: 'acct_connecteda',
    })
    expect(calls.at(-1)).toEqual({
      method: 'createCheckout',
      values: {
        connectedAccountId: 'acct_connecteda',
        fees: { oneTimeFeeAmount: 200, subscriptionPercent: 1 },
        idempotencyKey: `crewframe:funnel-checkout:funnel-a:${operationId}`,
        integrationIdentifier: integrationIdentifierFromOperationId(operationId),
        mode: 'subscription',
        priceIds: ['price_a', 'price_b'],
      },
    })
  })

  test('uses a stable identifier with an eight-letter per-operation suffix', () => {
    const identifier = integrationIdentifierFromOperationId(operationId)
    expect(identifier).toMatch(/^crewframe_funnel_checkout_v1_[a-z]{8}$/)
    expect(integrationIdentifierFromOperationId(operationId)).toBe(identifier)
    expect(
      integrationIdentifierFromOperationId(
        '6da57d36-ef9f-46ca-ab8b-bfe1b9b46112'
      )
    ).not.toBe(identifier)
  })

  test('configures a funnel only after verifying its proposed prices', async () => {
    const { calls, service } = harness()
    await expect(
      service.configureFunnelProducts({
        funnelId: 'funnel-a',
        selections: [
          { productId: 'price_a', recurring: true },
          { productId: 'price_b', recurring: true },
        ],
      })
    ).resolves.toEqual({ funnelId: 'funnel-a', subaccountId: 'sub-a' })
    expect(calls.at(-1)).toEqual({
      method: 'updateFunnelProducts',
      values: {
        funnelId: 'funnel-a',
        serializedSelections: JSON.stringify([
          { productId: 'price_a', recurring: true },
          { productId: 'price_b', recurring: true },
        ]),
        subaccountId: 'sub-a',
      },
    })
  })

  test('rejects malformed funnel configuration before reads or writes', async () => {
    for (const input of [
      {
        connectedAccountId: 'acct_injected',
        funnelId: 'funnel-a',
        selections: [],
      },
      {
        funnelId: 'funnel-a',
        selections: Array.from({ length: 21 }, (_, index) => ({
          productId: `price_${index}`,
          recurring: true,
        })),
      },
      {
        funnelId: 'funnel-a',
        selections: [{ productId: 'price_a', quantity: 500, recurring: true }],
      },
    ]) {
      const { calls, service } = harness()
      await expect(service.configureFunnelProducts(input)).rejects.toBeInstanceOf(
        ZodError
      )
      expect(calls).toEqual([])
    }
  })

  test.each([
    ['guest', harness({ role: Role.SUBACCOUNT_GUEST })],
    [
      'cross-tenant target',
      harness({ target: { ...defaultTarget, subaccountId: 'sub-b' } }),
    ],
    ['unknown price', harness({ prices: [defaultPrices[0]] })],
  ])('fails closed for %s funnel configuration', async (_, testHarness) => {
    await expect(
      testHarness.service.configureFunnelProducts({
        funnelId: 'funnel-a',
        selections: [
          { productId: 'price_a', recurring: true },
          { productId: 'price_b', recurring: true },
        ],
      })
    ).rejects.toBeInstanceOf(Error)
    expect(
      testHarness.calls.some(({ method }) => method === 'updateFunnelProducts')
    ).toBe(false)
  })

  test('fails closed when the tenant-scoped configuration update misses', async () => {
    const { calls, service } = harness({ updateResult: false })
    await expect(
      service.configureFunnelProducts({
        funnelId: 'funnel-a',
        selections: [
          { productId: 'price_a', recurring: true },
          { productId: 'price_b', recurring: true },
        ],
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(calls.at(-1)?.method).toBe('updateFunnelProducts')
  })

  test.each([
    ['missing funnel', null, defaultPrices],
    ['unpublished funnel', { ...defaultTarget, published: false }, defaultPrices],
    ['invalid JSON', { ...defaultTarget, liveProducts: '{' }, defaultPrices],
    ['empty cart', { ...defaultTarget, liveProducts: '[]' }, defaultPrices],
    [
      'oversized stored cart',
      {
        ...defaultTarget,
        liveProducts: JSON.stringify(
          Array.from({ length: 21 }, (_, index) => ({
            productId: `price_${index}`,
            recurring: true,
          }))
        ),
      },
      defaultPrices,
    ],
    [
      'unknown stored cart field',
      {
        ...defaultTarget,
        liveProducts: JSON.stringify([
          { productId: 'price_a', quantity: 999, recurring: true },
        ]),
      },
      defaultPrices,
    ],
    [
      'invalid connected account',
      { ...defaultTarget, connectedAccountId: 'not_an_account' },
      defaultPrices,
    ],
    [
      'duplicate selection',
      {
        ...defaultTarget,
        liveProducts: JSON.stringify([
          { productId: 'price_a', recurring: true },
          { productId: 'price_a', recurring: true },
        ]),
      },
      defaultPrices,
    ],
    [
      'inactive price',
      defaultTarget,
      [{ ...defaultPrices[0], active: false }, defaultPrices[1]],
    ],
    [
      'unsupported currency',
      defaultTarget,
      [{ ...defaultPrices[0], currency: 'eur' }, defaultPrices[1]],
    ],
    [
      'stored recurring mismatch',
      defaultTarget,
      [{ ...defaultPrices[0], recurring: false }, defaultPrices[1]],
    ],
    [
      'mixed modes',
      {
        ...defaultTarget,
        liveProducts: JSON.stringify([
          { productId: 'price_a', recurring: true },
          { productId: 'price_b', recurring: false },
        ]),
      },
      [defaultPrices[0], { ...defaultPrices[1], recurring: false }],
    ],
  ] as const)('fails closed for %s', async (_, target, prices) => {
    const { calls, service } = harness({
      prices: [...prices],
      target: target ? { ...target } : null,
    })
    await expect(
      service.createAuthenticatedFunnelCheckout({
        funnelId: 'funnel-a',
        operationId,
      })
    ).rejects.toBeInstanceOf(Error)
    expect(calls.some(({ method }) => method === 'createCheckout')).toBe(false)
  })

  test('rejects invalid server fee configuration before Stripe mutation', async () => {
    const { calls, service } = harness({
      fees: { oneTimeFeeAmount: -1, subscriptionPercent: 101 },
    })
    await expect(
      service.createAuthenticatedFunnelCheckout({
        funnelId: 'funnel-a',
        operationId,
      })
    ).rejects.toBeInstanceOf(ZodError)
    expect(calls.some(({ method }) => method === 'createCheckout')).toBe(false)
  })

  test('rejects a mismatched catalog target before Stripe', async () => {
    const calls: Array<{ method: string }> = []

    const mismatchedStore: CommerceStore = {
      findFunnelCheckoutTarget: async () => null,
      findSubaccountCommerceTarget: async () => ({
        connectedAccountId: 'acct_connecteda',
        subaccountId: 'sub-b',
      }),
      updateFunnelProducts: async () => false,
    }
    const isolated = createCommerceService({
      getFees: () => ({ oneTimeFeeAmount: 200, subscriptionPercent: 1 }),
      provider: {
        createCheckoutSession: async () => ({ clientSecret: 'unused' }),
        listProducts: async () => {
          calls.push({ method: 'listProducts' })
          return []
        },
        retrievePrices: async () => [],
      },
      resolveContext: async () => context(),
      store: mismatchedStore,
    })

    await expect(isolated.listConnectedProducts('sub-a')).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    expect(calls.some(({ method }) => method === 'listProducts')).toBe(false)
  })
})
