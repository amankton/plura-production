import { createStripeSdkWebhookVerifier } from '@/lib/stripe/webhook-intake'
import { getStripeWebhookRuntimeConfig } from '@/lib/stripe/webhook-runtime-config'
import { handleStripeWebhookRoute } from '@/lib/stripe/webhook-route-handler'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return handleStripeWebhookRoute(request, {
    resolveConfig: getStripeWebhookRuntimeConfig,
    loadRuntime: async () => {
      const { getStripeServerClient } = await import('@/lib/stripe')
      const stripe = getStripeServerClient()
      const { prismaWebhookIntakeStore } = await import(
        '@/lib/stripe/prisma-webhook-intake-store'
      )
      return {
        receiptStore: prismaWebhookIntakeStore,
        verifySignature: createStripeSdkWebhookVerifier(stripe.webhooks),
      }
    },
  })
}
