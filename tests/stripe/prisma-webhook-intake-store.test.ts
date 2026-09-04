import { describe, expect, test } from 'bun:test'
import { Prisma } from '@prisma/client'
import {
  createPrismaWebhookIntakeStore,
  isExactWebhookIdentityConflict,
  type PrismaWebhookReceiptDelegate,
} from '../../src/lib/stripe/prisma-webhook-intake-store-core'
import type { StripeWebhookReceiptDraft } from '../../src/lib/stripe/webhook-inbox-contract'

const draft: StripeWebhookReceiptDraft = {
  accountScopeKey: 'platform',
  customerId: 'cus_agency',
  eventId: 'evt_agency',
  eventType: 'customer.subscription.updated',
  mode: 'TEST',
  objectId: 'sub_agency',
  payloadHash: 'a'.repeat(64),
  providerCreatedAt: new Date('2026-09-03T18:00:00.000Z'),
  retentionExpiresAt: new Date('2026-10-03T18:00:00.000Z'),
  subscriptionId: 'sub_agency',
}

const row = {
  ...draft,
  attempts: 0,
  completedAt: null,
  id: '10000000-0000-4000-8000-000000000001',
  lastErrorCode: null,
  lastErrorMessage: null,
  leaseExpiresAt: null,
  leaseToken: null,
  nextRetryAt: null,
  status: 'RECEIVED' as const,
}

const prismaError = (code: string, target?: string | string[]) =>
  new Prisma.PrismaClientKnownRequestError('bounded database failure', {
    clientVersion: '5.22.0',
    code,
    meta: target === undefined ? undefined : { target },
  })

describe('Prisma Stripe webhook intake store', () => {
  test('creates a normalized receipt without adding processing behavior', async () => {
    let createInput: unknown
    const store = createPrismaWebhookIntakeStore({
      create: async (input) => {
        createInput = input
        return row
      },
      findUnique: async () => null,
    })
    expect(await store.insertOrGet(draft)).toEqual({
      inserted: true,
      receipt: row,
    })
    expect(createInput).toMatchObject({ data: draft })
  })

  test('resolves only the exact named composite conflict', async () => {
    let reads = 0
    const store = createPrismaWebhookIntakeStore({
      create: async () => {
        throw prismaError('P2002', 'stripe_webhook_identity')
      },
      findUnique: async (input) => {
        reads += 1
        expect(input.where.stripe_webhook_identity).toEqual({
          accountScopeKey: 'platform',
          eventId: 'evt_agency',
          mode: 'TEST',
        })
        return row
      },
    })
    expect(await store.insertOrGet(draft)).toEqual({
      inserted: false,
      receipt: row,
    })
    expect(reads).toBe(1)
  })

  test('accepts the complete composite field target in any order', () => {
    expect(
      isExactWebhookIdentityConflict(
        prismaError('P2002', ['eventId', 'mode', 'accountScopeKey'])
      )
    ).toBeTrue()
  })

  test('rejects unrelated unique and database errors without a duplicate read', async () => {
    for (const error of [
      prismaError('P2002', 'PRIMARY'),
      prismaError('P2002', ['eventId']),
      prismaError('P2002', ['mode', 'eventId', 'mode']),
      prismaError('P2002', ['mode', 'eventId', 'customerId']),
      prismaError('P2002', ['mode', 'eventId', 7] as unknown as string[]),
      prismaError('P2024'),
      new Error('database unavailable'),
    ]) {
      let reads = 0
      const delegate: PrismaWebhookReceiptDelegate = {
        create: async () => {
          throw error
        },
        findUnique: async () => {
          reads += 1
          return row
        },
      }
      expect(
        createPrismaWebhookIntakeStore(delegate).insertOrGet(draft)
      ).rejects.toBe(error)
      expect(reads).toBe(0)
    }
  })

  test('fails if an exact conflict cannot be resolved to the same identity', async () => {
    const error = prismaError('P2002', 'stripe_webhook_identity')
    const store = createPrismaWebhookIntakeStore({
      create: async () => {
        throw error
      },
      findUnique: async () => null,
    })
    expect(store.insertOrGet(draft)).rejects.toBe(error)
  })
})
