import 'server-only'

import { db } from '@/lib/db'
import {
  createPrismaWebhookIntakeStore,
  type PrismaWebhookReceiptDelegate,
} from './prisma-webhook-intake-store-core'

const receiptDelegate: PrismaWebhookReceiptDelegate = {
  create: (input) => db.stripeWebhookReceipt.create(input),
  findUnique: (input) => db.stripeWebhookReceipt.findUnique(input),
}

export const prismaWebhookIntakeStore =
  createPrismaWebhookIntakeStore(receiptDelegate)
