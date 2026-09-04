import { Prisma } from '@prisma/client'
import type {
  StripeWebhookReceipt,
  StripeWebhookReceiptDraft,
} from './webhook-inbox-contract'
import type { WebhookReceiptIntakeStore } from './webhook-intake'

const receiptSelect = {
  accountScopeKey: true,
  attempts: true,
  completedAt: true,
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
} satisfies Prisma.StripeWebhookReceiptSelect

type ReceiptRow = Prisma.StripeWebhookReceiptGetPayload<{
  select: typeof receiptSelect
}>

export type PrismaWebhookReceiptDelegate = {
  create(input: {
    data: StripeWebhookReceiptDraft
    select: typeof receiptSelect
  }): Promise<ReceiptRow>
  findUnique(input: {
    select: typeof receiptSelect
    where: {
      stripe_webhook_identity: {
        accountScopeKey: string
        eventId: string
        mode: 'TEST' | 'LIVE'
      }
    }
  }): Promise<ReceiptRow | null>
}

const toReceipt = (row: ReceiptRow): StripeWebhookReceipt => ({ ...row })

const exactIdentityTarget = new Set([
  'accountScopeKey',
  'eventId',
  'mode',
])

export const isExactWebhookIdentityConflict = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2002') return false

  const target = error.meta?.target
  if (target === 'stripe_webhook_identity') return true
  if (!Array.isArray(target) || target.length !== exactIdentityTarget.size) {
    return false
  }
  const fields = new Set(target)
  return (
    fields.size === exactIdentityTarget.size &&
    target.every(
      (field) => typeof field === 'string' && exactIdentityTarget.has(field)
    )
  )
}

export const createPrismaWebhookIntakeStore = (
  receipts: PrismaWebhookReceiptDelegate
): WebhookReceiptIntakeStore => ({
  insertOrGet: async (draft) => {
    try {
      return {
        inserted: true,
        receipt: toReceipt(
          await receipts.create({ data: draft, select: receiptSelect })
        ),
      }
    } catch (error) {
      if (!isExactWebhookIdentityConflict(error)) throw error
      const existing = await receipts.findUnique({
        select: receiptSelect,
        where: {
          stripe_webhook_identity: {
            accountScopeKey: draft.accountScopeKey,
            eventId: draft.eventId,
            mode: draft.mode,
          },
        },
      })
      if (!existing) throw error
      return { inserted: false, receipt: toReceipt(existing) }
    }
  },
})
