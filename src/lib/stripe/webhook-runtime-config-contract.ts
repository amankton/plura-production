export type StripeWebhookRuntimeEnvironment = {
  [key: string]: string | undefined
  STRIPE_CATALOG_MODE?: string
  STRIPE_WEBHOOK_INTAKE_MODE?: string
  STRIPE_WEBHOOK_SECRET_TEST?: string
}

export type StripeWebhookRuntimeConfig =
  | {
      enabled: false
      reason: 'disabled' | 'misconfigured'
    }
  | {
      enabled: true
      mode: 'TEST'
      secret: string
    }

export const resolveStripeWebhookRuntimeConfig = (
  environment: StripeWebhookRuntimeEnvironment
): StripeWebhookRuntimeConfig => {
  const intakeMode = environment.STRIPE_WEBHOOK_INTAKE_MODE
  if (intakeMode === undefined || intakeMode === 'disabled') {
    return { enabled: false, reason: 'disabled' }
  }
  if (intakeMode !== 'test') {
    return { enabled: false, reason: 'misconfigured' }
  }
  if (environment.STRIPE_CATALOG_MODE !== 'test') {
    return { enabled: false, reason: 'misconfigured' }
  }

  const secret = environment.STRIPE_WEBHOOK_SECRET_TEST
  if (!secret || secret !== secret.trim()) {
    return { enabled: false, reason: 'misconfigured' }
  }
  return { enabled: true, mode: 'TEST', secret }
}
