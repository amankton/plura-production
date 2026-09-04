import {
  receiveStripeWebhook,
  type StripeWebhookVerifier,
  type WebhookReceiptIntakeStore,
} from './webhook-intake'
import { isTerminalWebhookStatus } from './webhook-inbox-contract'
import type { StripeWebhookRuntimeConfig } from './webhook-runtime-config-contract'

export type StripeWebhookRouteRuntime = {
  receiptStore: WebhookReceiptIntakeStore
  verifySignature: StripeWebhookVerifier
}

export type StripeWebhookRouteDependencies = {
  loadRuntime(): Promise<StripeWebhookRouteRuntime>
  resolveConfig(): StripeWebhookRuntimeConfig
}

const jsonResponse = (status: number, code: string) =>
  Response.json(
    { code, received: status === 200 },
    { headers: { 'cache-control': 'no-store' }, status }
  )

export const handleStripeWebhookRoute = async (
  request: Pick<Request, 'body' | 'headers'>,
  dependencies: StripeWebhookRouteDependencies
): Promise<Response> => {
  let config: StripeWebhookRuntimeConfig
  try {
    config = dependencies.resolveConfig()
  } catch {
    return jsonResponse(503, 'webhook_intake_unavailable')
  }
  if (!config.enabled) {
    return jsonResponse(503, 'webhook_intake_unavailable')
  }

  let runtime: StripeWebhookRouteRuntime
  try {
    runtime = await dependencies.loadRuntime()
  } catch {
    return jsonResponse(503, 'webhook_intake_unavailable')
  }

  let result
  try {
    result = await receiveStripeWebhook(
      {
        body: request.body,
        contentLength: request.headers.get('content-length'),
        mode: config.mode,
        signature: request.headers.get('stripe-signature'),
      },
      {
        receiptStore: runtime.receiptStore,
        secrets: { TEST: config.secret },
        verifySignature: runtime.verifySignature,
      }
    )
  } catch {
    return jsonResponse(400, 'webhook_intake_failed')
  }

  if (!result.ok) return jsonResponse(result.httpStatus, result.code)
  if (!result.inserted && isTerminalWebhookStatus(result.receipt.status)) {
    return jsonResponse(200, 'webhook_receipt_terminal')
  }
  return jsonResponse(503, 'webhook_receipt_pending')
}
