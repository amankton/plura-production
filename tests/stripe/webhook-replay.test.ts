import { describe, expect, test } from 'bun:test'
import { WebhookProcessingError } from '../../src/lib/stripe/webhook-inbox-contract'
import {
  requestStripeWebhookReplay,
  type WebhookReplayAuditInput,
} from '../../src/lib/stripe/webhook-replay'

const receiptId = '10000000-0000-4000-8000-000000000001'

const setup = (authorized = true) => {
  const audits: WebhookReplayAuditInput[] = []
  const requeues: string[] = []
  return {
    audits,
    dependencies: {
      authorize: async () => authorized,
      store: {
        appendReplayAudit: async (input: WebhookReplayAuditInput) => {
          audits.push(input)
        },
        getReplayEligibility: async () => ({
          eligible: true,
          reasonCode: 'terminal_receipt',
        }),
        requeueTerminalReceipt: async (id: string) => {
          requeues.push(id)
          return true
        },
      },
    },
    requeues,
  }
}

describe('Stripe webhook receipt replay', () => {
  test('defaults to an audited dry run and does not enqueue', async () => {
    const context = setup()
    expect(
      await requestStripeWebhookReplay(
        'user_internal',
        { reason: 'Investigate terminal receipt', receiptId },
        context.dependencies
      )
    ).toEqual({
      dryRun: true,
      eligible: true,
      reasonCode: 'terminal_receipt',
    })
    expect(context.requeues).toHaveLength(0)
    expect(context.audits).toEqual([
      {
        actorId: 'user_internal',
        dryRun: true,
        outcome: 'DRY_RUN_READY',
        reason: 'Investigate terminal receipt',
        receiptId,
      },
    ])
  })

  test('requires internal authorization and records denial', async () => {
    const context = setup(false)
    expect(
      requestStripeWebhookReplay(
        'user_external',
        { reason: 'Attempt replay', receiptId },
        context.dependencies
      )
    ).rejects.toBeInstanceOf(WebhookProcessingError)
    expect(context.requeues).toHaveLength(0)
    expect(context.audits[0]).toMatchObject({
      actorId: 'user_external',
      outcome: 'REJECTED',
      safeErrorCode: 'replay_not_authorized',
    })
  })

  test('enqueues only a stored receipt ID after explicit execution', async () => {
    const context = setup()
    expect(
      await requestStripeWebhookReplay(
        'user_internal',
        { dryRun: false, reason: 'Retry after provider recovery', receiptId },
        context.dependencies
      )
    ).toEqual({ dryRun: false, eligible: true, enqueued: true })
    expect(context.requeues).toEqual([receiptId])
    expect(context.audits[0].outcome).toBe('ENQUEUED')
  })

  test('rejects arbitrary payload injection and unknown fields before action', async () => {
    const context = setup()
    expect(
      requestStripeWebhookReplay(
        'user_internal',
        {
          payload: { forged: true },
          reason: 'Attempt arbitrary replay',
          receiptId,
        },
        context.dependencies
      )
    ).rejects.toThrow()
    expect(context.requeues).toHaveLength(0)
    expect(context.audits).toHaveLength(0)
  })
})
