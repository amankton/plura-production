import 'server-only'

import { db } from '@/lib/db'
import { createPrismaWebhookProcessingAdapters } from './prisma-webhook-processing-store-core'

export const prismaWebhookProcessingAdapters =
  createPrismaWebhookProcessingAdapters(db)
