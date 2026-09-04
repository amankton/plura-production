import { describe, expect, test } from 'bun:test'
import { Prisma, type PrismaClient } from '@prisma/client'
import {
  createPrismaWebhookProcessingAdapters,
  isExactWebhookObjectIdentityConflict,
} from '../../src/lib/stripe/prisma-webhook-processing-store-core'

const prismaError = (code: string, target?: string | string[]) =>
  new Prisma.PrismaClientKnownRequestError('bounded database failure', {
    clientVersion: '5.22.0',
    code,
    meta: target === undefined ? undefined : { target },
  })

describe('Prisma Stripe webhook processing store contract', () => {
  test('accepts only the exact object-lease identity conflict', () => {
    expect(
      isExactWebhookObjectIdentityConflict(
        prismaError('P2002', 'stripe_webhook_object_identity')
      )
    ).toBeTrue()
    expect(
      isExactWebhookObjectIdentityConflict(
        prismaError('P2002', [
          'objectId',
          'mode',
          'accountScopeKey',
          'objectType',
        ])
      )
    ).toBeTrue()
    for (const error of [
      prismaError('P2002', 'PRIMARY'),
      prismaError('P2002', ['mode', 'objectId']),
      prismaError('P2002', ['mode', 'objectId', 'mode', 'objectType']),
      prismaError('P2002', [
        'mode',
        'objectId',
        'customerId',
        'objectType',
      ]),
      prismaError('P2034'),
      new Error('database unavailable'),
    ]) {
      expect(isExactWebhookObjectIdentityConflict(error)).toBeFalse()
    }
  })

  test('rejects an invalid due-work limit before querying Prisma', async () => {
    let queries = 0
    const client = {
      $queryRaw: async () => {
        queries += 1
        return []
      },
    } as unknown as PrismaClient
    const { dueWork } = createPrismaWebhookProcessingAdapters(client)
    for (const limit of [0, 1.1, 26, Number.NaN]) {
      expect(
        dueWork.listDueReceiptIds({
          limit,
          now: new Date('2026-09-03T18:00:00.000Z'),
        })
      ).rejects.toBeInstanceOf(TypeError)
    }
    expect(queries).toBe(0)
  })
})
