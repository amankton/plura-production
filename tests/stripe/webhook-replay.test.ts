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
  const atomicCalls: Array<{
    actorId: string
    reason: string
    receiptId: string
  }> = []
  let eligible = true
  let exists = true
  let failAtomicAudit = false
  let eligibilityReads = 0
  return {
    atomicCalls,
    audits,
    dependencies: {
      authorize: async () => authorized,
      store: {
        appendReplayAudit: async (input: WebhookReplayAuditInput) => {
          audits.push(input)
        },
        getReplayEligibility: async () => {
          eligibilityReads += 1
          return exists
            ? {
                eligible,
                reasonCode: eligible ? 'terminal_receipt' : 'receipt_not_terminal',
              }
            : null
        },
        requeueTerminalReceiptWithAudit: async (input: {
          actorId: string
          reason: string
          receiptId: string
        }) => {
          const auditCount = audits.length
          const requeueCount = requeues.length
          const wasEligible = eligible
          atomicCalls.push(input)
          try {
            if (!exists) {
              audits.push({
                ...input,
                dryRun: false,
                outcome: 'FAILED',
                safeErrorCode: 'receipt_not_found',
                safeErrorMessage: 'Webhook receipt was not found',
              })
              return {
                eligible: false,
                enqueued: false,
                reasonCode: 'receipt_not_found',
              }
            }
            if (!eligible) {
              audits.push({
                ...input,
                dryRun: false,
                outcome: 'FAILED',
                safeErrorCode: 'receipt_not_terminal',
                safeErrorMessage: 'Webhook receipt is not eligible for replay',
              })
              return {
                eligible: false,
                enqueued: false,
                reasonCode: 'receipt_not_terminal',
              }
            }

            eligible = false
            requeues.push(input.receiptId)
            if (failAtomicAudit) throw new Error('injected audit write failure')
            audits.push({ ...input, dryRun: false, outcome: 'ENQUEUED' })
            return {
              eligible: true,
              enqueued: true,
              reasonCode: 'terminal_receipt',
            }
          } catch (error) {
            eligible = wasEligible
            audits.splice(auditCount)
            requeues.splice(requeueCount)
            throw error
          }
        },
      },
    },
    getEligibilityReads: () => eligibilityReads,
    requeues,
    setAtomicAuditFailure: (value: boolean) => {
      failAtomicAudit = value
    },
    setEligible: (value: boolean) => {
      eligible = value
    },
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
    expect(context.atomicCalls).toHaveLength(1)
    expect(context.getEligibilityReads()).toBe(0)
  })

  test('rolls back replay when the atomic audit write fails', async () => {
    const context = setup()
    context.setAtomicAuditFailure(true)
    expect(
      requestStripeWebhookReplay(
        'user_internal',
        { dryRun: false, reason: 'Retry after provider recovery', receiptId },
        context.dependencies
      )
    ).rejects.toThrow('injected audit write failure')
    expect(context.requeues).toHaveLength(0)
    expect(context.audits).toHaveLength(0)

    context.setAtomicAuditFailure(false)
    expect(
      await requestStripeWebhookReplay(
        'user_internal',
        { dryRun: false, reason: 'Retry after provider recovery', receiptId },
        context.dependencies
      )
    ).toMatchObject({ enqueued: true })
    expect(context.requeues).toEqual([receiptId])
    expect(context.audits).toHaveLength(1)
    expect(context.audits[0].outcome).toBe('ENQUEUED')
  })

  test('uses the atomic eligibility decision and durably audits a race loss', async () => {
    const context = setup()
    context.setEligible(false)
    expect(
      await requestStripeWebhookReplay(
        'user_internal',
        { dryRun: false, reason: 'Retry after provider recovery', receiptId },
        context.dependencies
      )
    ).toEqual({ dryRun: false, eligible: false, enqueued: false })
    expect(context.getEligibilityReads()).toBe(0)
    expect(context.requeues).toHaveLength(0)
    expect(context.audits).toHaveLength(1)
    expect(context.audits[0]).toMatchObject({
      outcome: 'FAILED',
      safeErrorCode: 'receipt_not_terminal',
    })
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
