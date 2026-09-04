import {
  processStripeWebhookReceipt,
  type WebhookProcessorDependencies,
} from './webhook-processor'
import type { StripeWebhookDueWorkSource } from './prisma-webhook-processing-store-core'

export type StripeWebhookWorkerDependencies = WebhookProcessorDependencies & {
  dueWork: StripeWebhookDueWorkSource
}

export type StripeWebhookWorkerSummary = {
  attempted: number
  busy: number
  cancelled: boolean
  deadLetter: number
  failed: number
  ignored: number
  notFound: number
  retry: number
  selected: number
  succeeded: number
}

const emptySummary = (): StripeWebhookWorkerSummary => ({
  attempted: 0,
  busy: 0,
  cancelled: false,
  deadLetter: 0,
  failed: 0,
  ignored: 0,
  notFound: 0,
  retry: 0,
  selected: 0,
  succeeded: 0,
})

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const runStripeWebhookWorkerOnce = async (
  input: { limit: number; signal?: AbortSignal },
  dependencies: StripeWebhookWorkerDependencies
): Promise<Readonly<StripeWebhookWorkerSummary>> => {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 25) {
    throw new TypeError('Webhook batch limit must be an integer from 1 to 25')
  }
  const summary = emptySummary()
  if (input.signal?.aborted) {
    summary.cancelled = true
    return Object.freeze(summary)
  }

  const clock = dependencies.now ?? (() => new Date())
  const receiptIds = await dependencies.dueWork.listDueReceiptIds({
    limit: input.limit,
    now: clock(),
  })
  if (
    receiptIds.length > input.limit ||
    new Set(receiptIds).size !== receiptIds.length ||
    receiptIds.some((receiptId) => !uuidPattern.test(receiptId))
  ) {
    throw new TypeError('Webhook due-work source returned an invalid batch')
  }
  summary.selected = receiptIds.length

  const safeObserve: WebhookProcessorDependencies['observe'] = (observation) => {
    try {
      dependencies.observe?.(observation)
    } catch {
      // Observability is non-authoritative and cannot alter durable work.
    }
  }

  for (const receiptId of receiptIds) {
    if (input.signal?.aborted) {
      summary.cancelled = true
      break
    }
    summary.attempted += 1
    try {
      const result = await processStripeWebhookReceipt(receiptId, {
        agencies: dependencies.agencies,
        now: dependencies.now,
        observe: safeObserve,
        provider: dependencies.provider,
        randomToken: dependencies.randomToken,
        store: dependencies.store,
      })
      if (result.disposition === 'succeeded') summary.succeeded += 1
      else if (result.disposition === 'ignored') summary.ignored += 1
      else if (result.disposition === 'dead-letter') summary.deadLetter += 1
      else if (result.disposition === 'retry') summary.retry += 1
      else if (result.disposition === 'busy') summary.busy += 1
      else summary.notFound += 1
    } catch {
      summary.failed += 1
    }
  }

  if (input.signal?.aborted) summary.cancelled = true
  return Object.freeze(summary)
}
