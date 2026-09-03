import { describe, expect, test } from 'bun:test'
import { Role } from '@prisma/client'
import { ZodError } from 'zod'
import { AccessError } from '../../src/lib/auth/access-error'
import type { AgencyContext } from '../../src/lib/auth/agency-context'
import {
  createBillingService,
  type AgencyBillingProfile,
  type BillingProvider,
  type BillingStore,
} from '../../src/features/billing/billing-service'

const operationId = 'd514af8a-d4f5-4e74-a9af-34f6fc63353e'

const context = (role: Role = Role.AGENCY_OWNER): AgencyContext => ({
  actor: { id: 'user-a', providerSubject: 'user-a', role },
  agencyId: 'agency-a',
})

const profile = (
  overrides: Partial<AgencyBillingProfile> = {}
): AgencyBillingProfile => ({
  address: '1 Main Street',
  city: 'Los Angeles',
  companyEmail: 'owner@example.com',
  country: 'US',
  customerId: 'cus_agencya',
  id: 'agency-a',
  name: 'Agency A',
  state: 'CA',
  subscription: null,
  zipCode: '90001',
  ...overrides,
})

const harness = (values: {
  billingProfile?: AgencyBillingProfile | null
  customerAgencyId?: string | null
  customerDeleted?: boolean
  role?: Role
} = {}) => {
  const calls: Array<{ method: string; values?: unknown }> = []
  const billingProfile =
    values.billingProfile === undefined ? profile() : values.billingProfile
  const store: BillingStore = {
    attachCustomer: async (agencyId, customerId) => {
      calls.push({ method: 'attachCustomer', values: { agencyId, customerId } })
      return true
    },
    findAgencyBillingProfile: async (agencyId) => {
      calls.push({ method: 'findProfile', values: agencyId })
      return billingProfile
    },
  }
  const provider: BillingProvider = {
    bindCustomer: async (customerId, agencyId, idempotencyKey) => {
      calls.push({
        method: 'bindCustomer',
        values: { agencyId, customerId, idempotencyKey },
      })
    },
    createCustomer: async (customerProfile, idempotencyKey) => {
      calls.push({
        method: 'createCustomer',
        values: { idempotencyKey, profile: customerProfile },
      })
      return { id: 'cus_created' }
    },
    createSubscription: async (input) => {
      calls.push({ method: 'createSubscription', values: input })
      return { clientSecret: 'secret-created' }
    },
    getCustomer: async (customerId) => {
      calls.push({ method: 'getCustomer', values: customerId })
      return {
        agencyId:
          values.customerAgencyId === undefined
            ? 'agency-a'
            : values.customerAgencyId,
        deleted: values.customerDeleted ?? false,
        email: 'owner@example.com',
        id: customerId,
      }
    },
    listCharges: async (customerId) => {
      calls.push({ method: 'listCharges', values: customerId })
      return [
        {
          amount: 4900,
          created: 1_700_000_000,
          description: 'Crewframe Basic',
          id: 'ch_agencya',
        },
      ]
    },
    updateSubscription: async (input) => {
      calls.push({ method: 'updateSubscription', values: input })
      return { clientSecret: 'secret-updated' }
    },
  }
  const service = createBillingService({
    provider,
    resolveContext: async (agencyId) => {
      calls.push({ method: 'resolveContext', values: agencyId })
      return context(values.role)
    },
    store,
  })
  return { calls, service }
}

describe('agency billing authority', () => {
  test('rejects unknown and provider-owned selectors before authority or Stripe', async () => {
    const { calls, service } = harness()

    await expect(
      service.ensureAgencyCustomer({
        agencyId: 'agency-a',
        customerId: 'cus_injected',
        operationId,
      })
    ).rejects.toBeInstanceOf(ZodError)
    await expect(
      service.createOrChangeSubscription({
        agencyId: 'agency-a',
        operationId,
        plan: 'BASIC',
        priceId: 'price_injected',
      })
    ).rejects.toBeInstanceOf(ZodError)
    expect(calls).toEqual([])
  })

  test.each([
    Role.AGENCY_ADMIN,
    Role.SUBACCOUNT_USER,
    Role.SUBACCOUNT_GUEST,
  ])('denies %s from financial mutations before store or Stripe', async (role) => {
    const { calls, service } = harness({ role })
    await expect(
      service.createOrChangeSubscription({
        agencyId: 'agency-a',
        operationId,
        plan: 'BASIC',
      })
    ).rejects.toBeInstanceOf(AccessError)
    expect(calls.map(({ method }) => method)).toEqual(['resolveContext'])
  })

  test('creates and conditionally attaches a customer from stored agency data', async () => {
    const { calls, service } = harness({
      billingProfile: profile({ customerId: '' }),
    })
    await expect(
      service.ensureAgencyCustomer({ agencyId: 'agency-a', operationId })
    ).resolves.toEqual({ ready: true })

    const create = calls.find(({ method }) => method === 'createCustomer')
    expect(create?.values).toEqual({
      idempotencyKey: `crewframe:agency-customer:agency-a:${operationId}`,
      profile: profile({ customerId: '' }),
    })
    expect(calls.at(-1)).toEqual({
      method: 'attachCustomer',
      values: { agencyId: 'agency-a', customerId: 'cus_created' },
    })
  })

  test('never lists unfiltered charges when the agency has no customer', async () => {
    const { calls, service } = harness({
      billingProfile: profile({ customerId: '' }),
    })
    await expect(
      service.listAgencyCharges({ agencyId: 'agency-a' })
    ).resolves.toEqual([])
    expect(calls.some(({ method }) => method === 'getCustomer')).toBe(false)
    expect(calls.some(({ method }) => method === 'listCharges')).toBe(false)
  })

  test.each([
    ['missing agency', { billingProfile: null }],
    ['malformed customer', { billingProfile: profile({ customerId: 'bad' }) }],
    ['deleted customer', { customerDeleted: true }],
    ['unbound customer', { customerAgencyId: null }],
    ['foreign customer', { customerAgencyId: 'agency-b' }],
  ] as const)('makes zero charge-list calls for %s', async (_, values) => {
    const testHarness = harness(values)
    await expect(
      testHarness.service.listAgencyCharges({ agencyId: 'agency-a' })
    ).rejects.toBeInstanceOf(Error)
    expect(
      testHarness.calls.some(({ method }) => method === 'listCharges')
    ).toBe(false)
  })

  test('lists charges only for an agency-bound stored customer', async () => {
    const valid = harness()
    await expect(
      valid.service.listAgencyCharges({ agencyId: 'agency-a' })
    ).resolves.toEqual([
      {
        amount: 4900,
        created: 1_700_000_000,
        description: 'Crewframe Basic',
        id: 'ch_agencya',
      },
    ])
    expect(valid.calls.at(-1)).toEqual({
      method: 'listCharges',
      values: 'cus_agencya',
    })

    const conflict = harness({ customerAgencyId: 'agency-b' })
    await expect(
      conflict.service.listAgencyCharges({ agencyId: 'agency-a' })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(
      conflict.calls.some(({ method }) => method === 'listCharges')
    ).toBe(false)
  })

  test('rejects a mismatched profile or malformed stored provider IDs', async () => {
    for (const billingProfile of [
      profile({ id: 'agency-b' }),
      profile({ customerId: 'customer-injected' }),
      profile({
        subscription: {
          active: true,
          customerId: 'cus_agencya',
          subscriptionId: 'subscription-injected',
        },
      }),
    ]) {
      const { calls, service } = harness({ billingProfile })
      await expect(
        service.createOrChangeSubscription({
          agencyId: 'agency-a',
          operationId,
          plan: 'BASIC',
        })
      ).rejects.toBeInstanceOf(Error)
      expect(calls.some(({ method }) => method === 'getCustomer')).toBe(false)
    }
  })

  test('repairs only an unbound matching-email customer', async () => {
    const repair = harness({ customerAgencyId: null })
    await repair.service.ensureAgencyCustomer({
      agencyId: 'agency-a',
      operationId,
    })
    expect(repair.calls.at(-1)).toEqual({
      method: 'bindCustomer',
      values: {
        agencyId: 'agency-a',
        customerId: 'cus_agencya',
        idempotencyKey: `crewframe:agency-customer:agency-a:${operationId}:bind`,
      },
    })

    const conflict = harness({ customerAgencyId: 'agency-b' })
    await expect(
      conflict.service.ensureAgencyCustomer({
        agencyId: 'agency-a',
        operationId,
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(
      conflict.calls.some(({ method }) => method === 'bindCustomer')
    ).toBe(false)
  })

  test('creates a subscription with only the authorized stored customer', async () => {
    const { calls, service } = harness()
    await expect(
      service.createOrChangeSubscription({
        agencyId: 'agency-a',
        operationId,
        plan: 'UNLIMITED',
      })
    ).resolves.toEqual({ clientSecret: 'secret-created' })
    expect(calls.at(-1)).toEqual({
      method: 'createSubscription',
      values: {
        customerId: 'cus_agencya',
        idempotencyKey: `crewframe:agency-subscription:agency-a:UNLIMITED:${operationId}`,
        plan: 'UNLIMITED',
      },
    })
  })

  test('changes only a subscription whose stored customer matches the agency', async () => {
    const valid = harness({
      billingProfile: profile({
        subscription: {
          active: true,
          customerId: 'cus_agencya',
          subscriptionId: 'sub_agencya',
        },
      }),
    })
    await valid.service.createOrChangeSubscription({
      agencyId: 'agency-a',
      operationId,
      plan: 'BASIC',
    })
    expect(valid.calls.at(-1)).toMatchObject({
      method: 'updateSubscription',
      values: {
        customerId: 'cus_agencya',
        plan: 'BASIC',
        subscriptionId: 'sub_agencya',
      },
    })

    const conflict = harness({
      billingProfile: profile({
        subscription: {
          active: true,
          customerId: 'cus_other',
          subscriptionId: 'sub_other',
        },
      }),
    })
    await expect(
      conflict.service.createOrChangeSubscription({
        agencyId: 'agency-a',
        operationId,
        plan: 'BASIC',
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(
      conflict.calls.some(({ method }) => method === 'updateSubscription')
    ).toBe(false)
  })
})
