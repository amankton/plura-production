import { describe, expect, test } from 'bun:test'
import type { Contact } from '@prisma/client'
import { AccessError } from '../../src/lib/auth/access-error'
import { createPublicLeadService } from '../../src/features/contacts/public-lead-service'

const contact = (subaccountId: string): Contact => ({
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  email: 'lead@example.com',
  id: '82c0af28-0147-4956-9f88-f17729a05c99',
  name: 'Lead',
  subAccountId: subaccountId,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
})

describe('public lead submission', () => {
  test('derives contact ownership from a published funnel', async () => {
    const writes: string[] = []
    const service = createPublicLeadService({
      create: async (subaccountId) => {
        writes.push(subaccountId)
        return contact(subaccountId)
      },
      resolvePublishedFunnel: async (funnelId) =>
        funnelId === 'published-funnel'
          ? { subaccountId: 'server-derived-subaccount' }
          : null,
    })

    await service.submit({
      email: 'lead@example.com',
      funnelId: 'published-funnel',
      name: 'Lead',
    })

    expect(writes).toEqual(['server-derived-subaccount'])
  })

  test('rejects unpublished or unknown funnels without writing', async () => {
    let writes = 0
    const service = createPublicLeadService({
      create: async () => {
        writes += 1
        return contact('sub-a')
      },
      resolvePublishedFunnel: async () => null,
    })

    await expect(
      service.submit({
        email: 'lead@example.com',
        funnelId: 'draft-funnel',
        name: 'Lead',
      })
    ).rejects.toBeInstanceOf(AccessError)
    expect(writes).toBe(0)
  })

  test('rejects a browser-supplied subaccount field', async () => {
    let writes = 0
    const service = createPublicLeadService({
      create: async () => {
        writes += 1
        return contact('sub-a')
      },
      resolvePublishedFunnel: async () => ({ subaccountId: 'sub-a' }),
    })

    await expect(
      service.submit({
        email: 'lead@example.com',
        funnelId: 'published-funnel',
        name: 'Lead',
        subaccountId: 'attacker-selected-subaccount',
      } as never)
    ).rejects.toThrow()
    expect(writes).toBe(0)
  })
})
