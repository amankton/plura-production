import { z } from 'zod'
import { WebhookProcessingError } from './webhook-inbox-contract'

const replayCommandSchema = z
  .object({
    dryRun: z.boolean().optional().default(true),
    reason: z.string().trim().min(3).max(240),
    receiptId: z.string().uuid(),
  })
  .strict()

export type WebhookReplayOutcome =
  | 'DRY_RUN_READY'
  | 'ENQUEUED'
  | 'FAILED'
  | 'REJECTED'

export type WebhookReplayAuditInput = {
  actorId: string
  dryRun: boolean
  outcome: WebhookReplayOutcome
  reason: string
  receiptId: string
  safeErrorCode?: string
  safeErrorMessage?: string
}

export type WebhookReplayStore = {
  appendReplayAudit(input: WebhookReplayAuditInput): Promise<void>
  getReplayEligibility(receiptId: string): Promise<{
    eligible: boolean
    reasonCode: string
  } | null>
  requeueTerminalReceipt(receiptId: string): Promise<boolean>
}

export type WebhookReplayDependencies = {
  authorize(actorId: string): Promise<boolean>
  store: WebhookReplayStore
}

export const requestStripeWebhookReplay = async (
  actorId: string,
  rawCommand: unknown,
  dependencies: WebhookReplayDependencies
) => {
  const command = replayCommandSchema.parse(rawCommand)
  const authorized = await dependencies.authorize(actorId)
  if (!authorized) {
    await dependencies.store.appendReplayAudit({
      actorId,
      dryRun: command.dryRun,
      outcome: 'REJECTED',
      reason: command.reason,
      receiptId: command.receiptId,
      safeErrorCode: 'replay_not_authorized',
      safeErrorMessage: 'Webhook replay is not authorized',
    })
    throw new WebhookProcessingError(
      'replay_not_authorized',
      'Webhook replay is not authorized',
      false
    )
  }

  const eligibility = await dependencies.store.getReplayEligibility(
    command.receiptId
  )
  if (!eligibility) {
    await dependencies.store.appendReplayAudit({
      actorId,
      dryRun: command.dryRun,
      outcome: 'FAILED',
      reason: command.reason,
      receiptId: command.receiptId,
      safeErrorCode: 'receipt_not_found',
      safeErrorMessage: 'Webhook receipt was not found',
    })
    throw new WebhookProcessingError(
      'receipt_not_found',
      'Webhook receipt was not found',
      false
    )
  }

  if (command.dryRun) {
    await dependencies.store.appendReplayAudit({
      actorId,
      dryRun: true,
      outcome: 'DRY_RUN_READY',
      reason: command.reason,
      receiptId: command.receiptId,
    })
    return { dryRun: true, ...eligibility }
  }

  const enqueued =
    eligibility.eligible &&
    (await dependencies.store.requeueTerminalReceipt(command.receiptId))
  await dependencies.store.appendReplayAudit({
    actorId,
    dryRun: false,
    outcome: enqueued ? 'ENQUEUED' : 'FAILED',
    reason: command.reason,
    receiptId: command.receiptId,
    ...(enqueued
      ? {}
      : {
          safeErrorCode: eligibility.reasonCode,
          safeErrorMessage: 'Webhook receipt is not eligible for replay',
        }),
  })
  return { dryRun: false, eligible: eligibility.eligible, enqueued }
}
