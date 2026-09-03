import { describe, expect, test } from 'bun:test'
import { Role, type Contact } from '@prisma/client'
import { AccessError } from '../../src/lib/auth/access-error'
import type { TenantContext } from '../../src/lib/auth/tenant-context'
import {
  createContactService,
  type ContactStore,
} from '../../src/features/contacts/contact-service'
import {
  buildContactListArgs,
  buildContactSearchArgs,
  buildContactUpdateWhere,
} from '../../src/features/contacts/contact-query-scope'

const contactId = '82c0af28-0147-4956-9f88-f17729a05c99'

const contact = (overrides: Partial<Contact> = {}): Contact => ({
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  email: 'person@example.com',
  id: contactId,
  name: 'Person',
  subAccountId: 'sub-a',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
})

const context = (
  role: Role = Role.SUBACCOUNT_USER,
  subaccountId = 'sub-a'
): TenantContext => ({
  actor: { id: 'user-a', providerSubject: 'user-a', role },
  agencyId: 'agency-a',
  correlationId: 'correlation-a',
  scope: { subaccountIds: [subaccountId] },
  subaccountId,
})

const createStore = () => {
  const calls: Array<{ args: unknown[]; method: string }> = []
  const store: ContactStore = {
    create: async (...args) => {
      calls.push({ args, method: 'create' })
      return contact({ subAccountId: args[0], ...args[1] })
    },
    list: async (...args) => {
      calls.push({ args, method: 'list' })
      return []
    },
    search: async (...args) => {
      calls.push({ args, method: 'search' })
      return []
    },
    update: async (...args) => {
      calls.push({ args, method: 'update' })
      return contact({ id: args[1], subAccountId: args[0], ...args[2] })
    },
  }
  return { calls, store }
}

describe('authenticated contact service', () => {
  test('builds tenant-scoped Prisma read and update predicates', () => {
    expect(buildContactListArgs('sub-a', 250)).toMatchObject({
      take: 250,
      where: { subAccountId: 'sub-a' },
    })
    expect(buildContactSearchArgs('sub-a', 'Ada', 25)).toMatchObject({
      take: 25,
      where: {
        name: { contains: 'Ada' },
        subAccountId: 'sub-a',
      },
    })
    expect(buildContactUpdateWhere('sub-a', contactId)).toEqual({
      id: contactId,
      subAccountId: 'sub-a',
    })
  })

  test('scopes list and bounded search to the authorized subaccount', async () => {
    const { calls, store } = createStore()
    const service = createContactService({
      resolveContext: async () => context(Role.SUBACCOUNT_GUEST),
      store,
    })

    await service.list('sub-a')
    await service.search('sub-a', '  Ada  ')

    expect(calls).toEqual([
      { args: ['sub-a', 250], method: 'list' },
      { args: ['sub-a', 'Ada', 25], method: 'search' },
    ])
  })

  test('returns no results and performs no query for blank search', async () => {
    const { calls, store } = createStore()
    const service = createContactService({
      resolveContext: async () => context(),
      store,
    })

    await expect(service.search('sub-a', undefined)).resolves.toEqual([])
    await expect(service.search('sub-a', '   ')).resolves.toEqual([])
    expect(calls).toHaveLength(0)
  })

  test('uses server-derived scope for create and accepts no record id', async () => {
    const { calls, store } = createStore()
    const service = createContactService({
      resolveContext: async () => context(Role.SUBACCOUNT_USER, 'sub-a'),
      store,
    })

    await service.create({
      email: 'new@example.com',
      name: 'New Person',
      subaccountId: 'sub-a',
    })

    expect(calls).toEqual([
      {
        args: ['sub-a', { email: 'new@example.com', name: 'New Person' }],
        method: 'create',
      },
    ])
  })

  test('updates with both authorized subaccount id and contact id', async () => {
    const { calls, store } = createStore()
    const service = createContactService({
      resolveContext: async () => context(),
      store,
    })

    await service.update({
      contactId,
      email: 'updated@example.com',
      name: 'Updated Person',
      subaccountId: 'sub-a',
    })

    expect(calls).toEqual([
      {
        args: [
          'sub-a',
          contactId,
          { email: 'updated@example.com', name: 'Updated Person' },
        ],
        method: 'update',
      },
    ])
  })

  test('denied guest mutations cause zero writes', async () => {
    const { calls, store } = createStore()
    const service = createContactService({
      resolveContext: async () => context(Role.SUBACCOUNT_GUEST),
      store,
    })

    await expect(
      service.create({
        email: 'new@example.com',
        name: 'New Person',
        subaccountId: 'sub-a',
      })
    ).rejects.toBeInstanceOf(AccessError)

    await expect(
      service.update({
        contactId,
        email: 'updated@example.com',
        name: 'Updated Person',
        subaccountId: 'sub-a',
      })
    ).rejects.toBeInstanceOf(AccessError)
    expect(calls).toHaveLength(0)
  })

  test('malformed commands cause zero persistence calls', async () => {
    const { calls, store } = createStore()
    const service = createContactService({
      resolveContext: async () => context(),
      store,
    })

    await expect(service.create(null as never)).rejects.toThrow()
    await expect(
      service.create({
        email: 'new@example.com',
        name: 'New Person',
        subaccountId: 'x'.repeat(129),
      })
    ).rejects.toThrow()
    await expect(
      service.update({
        contactId: 'not-a-uuid',
        email: 'updated@example.com',
        name: 'Updated Person',
        subaccountId: 'sub-a',
      })
    ).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })

  test('a contact outside the scoped update predicate is non-enumerating', async () => {
    const { calls, store } = createStore()
    store.update = async (...args) => {
      calls.push({ args, method: 'update' })
      return null
    }
    const service = createContactService({
      resolveContext: async () => context(),
      store,
    })

    try {
      await service.update({
        contactId,
        email: 'updated@example.com',
        name: 'Updated Person',
        subaccountId: 'sub-a',
      })
      throw new Error('Expected update to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(AccessError)
      expect((error as AccessError).code).toBe('RESOURCE_NOT_FOUND')
    }
    expect(calls).toHaveLength(1)
  })
})
