import 'server-only'

import { resolveStripeWebhookRuntimeConfig } from './webhook-runtime-config-contract'

export const getStripeWebhookRuntimeConfig = () =>
  resolveStripeWebhookRuntimeConfig(process.env)
