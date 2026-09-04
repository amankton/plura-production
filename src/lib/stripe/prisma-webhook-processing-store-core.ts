import { Plan, Prisma, type PrismaClient } from '@prisma/client'
import {
  STRIPE_WEBHOOK_LEASE_MILLISECONDS,
  WebhookProcessingError,
  decideReceiptClaim,
  decideReceiptFailure,
  type StripeWebhookObjectLease,
  type StripeWebhookReceipt,
} from './webhook-inbox-contract'
import type {
  StripeWebhookAgency,
  WebhookAgencyDirectory,
  WebhookProcessingStore,
} from './webhook-processor'

const receiptSelect = {
  accountScopeKey: true,
  attempts: true,
  completedAt: true,
  createdAt: true,
  customerId: true,
  eventId: true,
  eventType: true,
  id: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  leaseExpiresAt: true,
  leaseToken: true,
  mode: true,
  nextRetryAt: true,
  objectId: true,
  payloadHash: true,
  providerCreatedAt: true,
  retentionExpiresAt: true,
  status: true,
  subscriptionId: true,
  updatedAt: true,
} satisfies Prisma.StripeWebhookReceiptSelect

type ReceiptRow = Prisma.StripeWebhookReceiptGetPayload<{
  select: typeof receiptSelect
}>

const objectLeaseSelect = {
  accountScopeKey: true,
  id: true,
  leaseExpiresAt: true,
  leaseToken: true,
  mode: true,
  objectId: true,
  objectType: true,
  updatedAt: true,
} satisfies Prisma.StripeWebhookObjectLeaseSelect

type ObjectLeaseRow = Prisma.StripeWebhookObjectLeaseGetPayload<{
  select: typeof objectLeaseSelect
}>

export type StripeWebhookDueWorkSource = {
  listDueReceiptIds(input: { limit: number; now: Date }): Promise<string[]>
}

export type PrismaWebhookProcessingAdapters = {
  agencies: WebhookAgencyDirectory
  dueWork: StripeWebhookDueWorkSource
  store: WebhookProcessingStore
}

class ConditionalWebhookMutationError extends Error {
  constructor() {
    super('Conditional webhook mutation did not own the target state')
    this.name = 'ConditionalWebhookMutationError'
  }
}

const toReceipt = (row: ReceiptRow): StripeWebhookReceipt => ({
  accountScopeKey: row.accountScopeKey,
  attempts: row.attempts,
  completedAt: row.completedAt,
  customerId: row.customerId,
  eventId: row.eventId,
  eventType: row.eventType,
  id: row.id,
  lastErrorCode: row.lastErrorCode,
  lastErrorMessage: row.lastErrorMessage,
  leaseExpiresAt: row.leaseExpiresAt,
  leaseToken: row.leaseToken,
  mode: row.mode,
  nextRetryAt: row.nextRetryAt,
  objectId: row.objectId,
  payloadHash: row.payloadHash,
  providerCreatedAt: row.providerCreatedAt,
  retentionExpiresAt: row.retentionExpiresAt,
  status: row.status,
  subscriptionId: row.subscriptionId,
})

const receiptCasWhere = (row: ReceiptRow) => ({
  attempts: row.attempts,
  id: row.id,
  leaseExpiresAt: row.leaseExpiresAt,
  leaseToken: row.leaseToken,
  mode: row.mode,
  nextRetryAt: row.nextRetryAt,
  status: row.status,
  updatedAt: row.updatedAt,
})

const receiptTransitionData = (receipt: StripeWebhookReceipt) => ({
  attempts: receipt.attempts,
  completedAt: receipt.completedAt,
  lastErrorCode: receipt.lastErrorCode,
  lastErrorMessage: receipt.lastErrorMessage,
  leaseExpiresAt: receipt.leaseExpiresAt,
  leaseToken: receipt.leaseToken,
  nextRetryAt: receipt.nextRetryAt,
  status: receipt.status,
})

const objectLeaseMatchesReceipt = (
  row: ReceiptRow,
  lease: StripeWebhookObjectLease
) =>
  row.subscriptionId !== null &&
  row.accountScopeKey === lease.accountScopeKey &&
  row.mode === lease.mode &&
  row.subscriptionId === lease.objectId &&
  lease.objectType === 'subscription'

const exactObjectIdentity = new Set([
  'accountScopeKey',
  'mode',
  'objectId',
  'objectType',
])

export const isExactWebhookObjectIdentityConflict = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2002') return false
  const target = error.meta?.target
  if (target === 'stripe_webhook_object_identity') return true
  if (!Array.isArray(target) || target.length !== exactObjectIdentity.size) {
    return false
  }
  const fields = new Set(target)
  return (
    fields.size === exactObjectIdentity.size &&
    target.every(
      (field) => typeof field === 'string' && exactObjectIdentity.has(field)
    )
  )
}

const isRetryableTransactionConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2034'

const serializable = async <T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>
) => {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      })
    } catch (error) {
      lastError = error
      if (!isRetryableTransactionConflict(error) || attempt === 2) throw error
    }
  }
  throw lastError
}

const requireOwnedObjectLease = async (
  transaction: Prisma.TransactionClient,
  lease: StripeWebhookObjectLease,
  now: Date
) => {
  if (lease.mode !== 'TEST') throw new ConditionalWebhookMutationError()
  const current = await transaction.stripeWebhookObjectLease.findUnique({
    select: objectLeaseSelect,
    where: {
      stripe_webhook_object_identity: {
        accountScopeKey: lease.accountScopeKey,
        mode: lease.mode,
        objectId: lease.objectId,
        objectType: lease.objectType,
      },
    },
  })
  if (
    !current ||
    current.leaseToken !== lease.leaseToken ||
    current.leaseExpiresAt.getTime() <= now.getTime()
  ) {
    throw new ConditionalWebhookMutationError()
  }
  return current
}

const releaseOwnedObjectLease = async (
  transaction: Prisma.TransactionClient,
  lease: ObjectLeaseRow,
  now: Date
) => {
  const deleted = await transaction.stripeWebhookObjectLease.deleteMany({
    where: {
      accountScopeKey: lease.accountScopeKey,
      id: lease.id,
      leaseExpiresAt: { gt: now },
      leaseToken: lease.leaseToken,
      mode: lease.mode,
      objectId: lease.objectId,
      objectType: lease.objectType,
      updatedAt: lease.updatedAt,
    },
  })
  if (deleted.count !== 1) throw new ConditionalWebhookMutationError()
}

export const createPrismaWebhookProcessingAdapters = (
  client: PrismaClient
): PrismaWebhookProcessingAdapters => {
  const dueWork: StripeWebhookDueWorkSource = {
    listDueReceiptIds: async ({ limit, now }) => {
      if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
        throw new TypeError('Webhook batch limit must be an integer from 1 to 25')
      }
      const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM StripeWebhookReceipt
        WHERE mode = 'TEST'
          AND (
            status = 'RECEIVED'
            OR (status = 'RETRY_PENDING' AND nextRetryAt <= ${now})
            OR (
              status = 'PROCESSING'
              AND (leaseExpiresAt IS NULL OR leaseExpiresAt <= ${now})
            )
          )
        ORDER BY
          CASE
            WHEN status = 'RETRY_PENDING' THEN nextRetryAt
            WHEN status = 'PROCESSING' THEN COALESCE(leaseExpiresAt, createdAt)
            ELSE createdAt
          END ASC,
          createdAt ASC,
          id ASC
        LIMIT ${limit}
      `)
      return rows.map(({ id }) => id)
    },
  }

  const agencies: WebhookAgencyDirectory = {
    findAgenciesByCustomerId: async (
      customerId
    ): Promise<StripeWebhookAgency[]> =>
      client.agency.findMany({
        orderBy: { id: 'asc' },
        select: { customerId: true, id: true },
        take: 2,
        where: { customerId },
      }),
  }

  const store: WebhookProcessingStore = {
    getReceipt: async (receiptId) => {
      const row = await client.stripeWebhookReceipt.findUnique({
        select: receiptSelect,
        where: { id: receiptId },
      })
      return row ? toReceipt(row) : null
    },

    claimReceipt: async ({ leaseToken, now, receiptId }) =>
      serializable(client, async (transaction) => {
        const row = await transaction.stripeWebhookReceipt.findUnique({
          select: receiptSelect,
          where: { id: receiptId },
        })
        if (!row || row.mode !== 'TEST') return null
        const decision = decideReceiptClaim(toReceipt(row), now, leaseToken)
        if (decision.kind === 'denied') return null

        const updated = await transaction.stripeWebhookReceipt.updateMany({
          data: receiptTransitionData(decision.next),
          where: receiptCasWhere(row),
        })
        if (updated.count !== 1) return null
        return decision.kind === 'claimed' ? decision.next : null
      }),

    claimObjectLease: async ({ key, leaseToken, now }) => {
      if (key.mode !== 'TEST') return null
      try {
        return await serializable(client, async (transaction) => {
          const current =
            await transaction.stripeWebhookObjectLease.findUnique({
              select: objectLeaseSelect,
              where: {
                stripe_webhook_object_identity: {
                  accountScopeKey: key.accountScopeKey,
                  mode: key.mode,
                  objectId: key.objectId,
                  objectType: key.objectType,
                },
              },
            })
          const leaseExpiresAt = new Date(
            now.getTime() + STRIPE_WEBHOOK_LEASE_MILLISECONDS
          )
          if (!current) {
            const created = await transaction.stripeWebhookObjectLease.create({
              data: { ...key, leaseExpiresAt, leaseToken },
              select: objectLeaseSelect,
            })
            return {
              accountScopeKey: created.accountScopeKey,
              leaseExpiresAt: created.leaseExpiresAt,
              leaseToken: created.leaseToken,
              mode: created.mode,
              objectId: created.objectId,
              objectType: 'subscription' as const,
            }
          }
          if (current.leaseExpiresAt.getTime() > now.getTime()) return null
          const updated =
            await transaction.stripeWebhookObjectLease.updateMany({
              data: { leaseExpiresAt, leaseToken },
              where: {
                accountScopeKey: current.accountScopeKey,
                id: current.id,
                leaseExpiresAt: current.leaseExpiresAt,
                leaseToken: current.leaseToken,
                mode: current.mode,
                objectId: current.objectId,
                objectType: current.objectType,
                updatedAt: current.updatedAt,
              },
            })
          return updated.count === 1
            ? { ...key, leaseExpiresAt, leaseToken }
            : null
        })
      } catch (error) {
        if (isExactWebhookObjectIdentityConflict(error)) return null
        throw error
      }
    },

    completeIgnored: async ({ now, reasonCode, receiptId, receiptLeaseToken }) => {
      if (!/^[a-z0-9_]{1,64}$/.test(reasonCode)) return false
      const result = await client.stripeWebhookReceipt.updateMany({
        data: {
          completedAt: now,
          lastErrorCode: reasonCode,
          lastErrorMessage: 'Webhook event was intentionally ignored',
          leaseExpiresAt: null,
          leaseToken: null,
          nextRetryAt: null,
          status: 'IGNORED',
        },
        where: {
          id: receiptId,
          leaseExpiresAt: { gt: now },
          leaseToken: receiptLeaseToken,
          mode: 'TEST',
          status: 'PROCESSING',
        },
      })
      return result.count === 1
    },

    failReceipt: async ({
      error,
      now,
      objectLease,
      receiptId,
      receiptLeaseToken,
    }) => {
      try {
        return await serializable(client, async (transaction) => {
          const row = await transaction.stripeWebhookReceipt.findUnique({
            select: receiptSelect,
            where: { id: receiptId },
          })
          if (!row || row.mode !== 'TEST') {
            throw new ConditionalWebhookMutationError()
          }
          const decision = decideReceiptFailure(
            toReceipt(row),
            receiptLeaseToken,
            error,
            now
          )
          if (objectLease && !objectLeaseMatchesReceipt(row, objectLease)) {
            throw new ConditionalWebhookMutationError()
          }
          const ownedObjectLease = objectLease
            ? await requireOwnedObjectLease(transaction, objectLease, now)
            : null
          const updated = await transaction.stripeWebhookReceipt.updateMany({
            data: receiptTransitionData(decision.next),
            where: receiptCasWhere(row),
          })
          if (updated.count !== 1) {
            throw new ConditionalWebhookMutationError()
          }
          if (ownedObjectLease) {
            await releaseOwnedObjectLease(transaction, ownedObjectLease, now)
          }
          return decision.next
        })
      } catch (error) {
        if (
          error instanceof ConditionalWebhookMutationError ||
          (error instanceof WebhookProcessingError &&
            error.code === 'invalid_receipt_lease')
        ) {
          return null
        }
        throw error
      }
    },

    projectAndComplete: async ({
      now,
      objectLease,
      projection,
      receiptId,
      receiptLeaseToken,
    }) => {
      try {
        return await serializable(client, async (transaction) => {
          const row = await transaction.stripeWebhookReceipt.findUnique({
            select: receiptSelect,
            where: { id: receiptId },
          })
          if (
            !row ||
            row.mode !== 'TEST' ||
            row.accountScopeKey !== 'platform' ||
            row.status !== 'PROCESSING' ||
            row.leaseToken !== receiptLeaseToken ||
            !row.leaseExpiresAt ||
            row.leaseExpiresAt.getTime() <= now.getTime() ||
            !objectLeaseMatchesReceipt(row, objectLease) ||
            row.subscriptionId !== projection.subscriptionId ||
            (row.customerId !== null &&
              row.customerId !== projection.customerId)
          ) {
            throw new ConditionalWebhookMutationError()
          }
          const ownedObjectLease = await requireOwnedObjectLease(
            transaction,
            objectLease,
            now
          )
          const matchingAgencies = await transaction.agency.findMany({
            orderBy: { id: 'asc' },
            select: { customerId: true, id: true },
            take: 2,
            where: { customerId: projection.customerId },
          })
          if (
            matchingAgencies.length !== 1 ||
            matchingAgencies[0].id !== projection.agencyId ||
            matchingAgencies[0].customerId !== projection.customerId
          ) {
            throw new ConditionalWebhookMutationError()
          }

          const [agencySubscription, providerSubscription] = await Promise.all([
            transaction.subscription.findUnique({
              select: {
                agencyId: true,
                id: true,
                plan: true,
                price: true,
                subscritiptionId: true,
              },
              where: { agencyId: projection.agencyId },
            }),
            transaction.subscription.findUnique({
              select: { agencyId: true, id: true },
              where: { subscritiptionId: projection.subscriptionId },
            }),
          ])
          if (
            (agencySubscription &&
              agencySubscription.subscritiptionId !==
                projection.subscriptionId) ||
            (providerSubscription &&
              providerSubscription.agencyId !== projection.agencyId)
          ) {
            throw new ConditionalWebhookMutationError()
          }

          const data = {
            active: projection.active,
            customerId: projection.customerId,
            currentPeriodEndDate: projection.currentPeriodEndDate,
            logicalPlan:
              projection.logicalPlan === 'BASIC' ? Plan.BASIC : Plan.UNLIMITED,
            priceId: projection.priceId,
            subscritiptionId: projection.subscriptionId,
          }
          if (agencySubscription) {
            const updatedSubscription = await transaction.subscription.updateMany({
              data,
              where: {
                agencyId: projection.agencyId,
                id: agencySubscription.id,
                subscritiptionId: agencySubscription.subscritiptionId,
              },
            })
            if (updatedSubscription.count !== 1) {
              throw new ConditionalWebhookMutationError()
            }
          } else {
            await transaction.subscription.create({
              data: { ...data, agencyId: projection.agencyId },
            })
          }

          const completed = await transaction.stripeWebhookReceipt.updateMany({
            data: {
              completedAt: now,
              lastErrorCode: null,
              lastErrorMessage: null,
              leaseExpiresAt: null,
              leaseToken: null,
              nextRetryAt: null,
              status: 'SUCCEEDED',
            },
            where: receiptCasWhere(row),
          })
          if (completed.count !== 1) {
            throw new ConditionalWebhookMutationError()
          }
          await releaseOwnedObjectLease(transaction, ownedObjectLease, now)
          return true
        })
      } catch (error) {
        if (error instanceof ConditionalWebhookMutationError) return false
        throw error
      }
    },
  }

  return { agencies, dueWork, store }
}
