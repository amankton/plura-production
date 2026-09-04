import { describe, expect, test } from 'bun:test'
import { resolveStripeWebhookRuntimeConfig } from '../../src/lib/stripe/webhook-runtime-config-contract'

describe('Stripe webhook runtime configuration', () => {
  test('defaults only an absent mode to disabled', () => {
    expect(resolveStripeWebhookRuntimeConfig({})).toEqual({
      enabled: false,
      reason: 'disabled',
    })
    expect(
      resolveStripeWebhookRuntimeConfig({
        STRIPE_WEBHOOK_INTAKE_MODE: 'disabled',
      })
    ).toEqual({ enabled: false, reason: 'disabled' })
  })

  test('fails closed for malformed mode, catalog, or Test secret', () => {
    for (const environment of [
      { STRIPE_WEBHOOK_INTAKE_MODE: '' },
      { STRIPE_WEBHOOK_INTAKE_MODE: 'live' },
      { STRIPE_WEBHOOK_INTAKE_MODE: 'TEST' },
      { STRIPE_WEBHOOK_INTAKE_MODE: ' test ' },
      {
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET_TEST: 'test-secret',
      },
      {
        STRIPE_CATALOG_MODE: '',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET_TEST: 'test-secret',
      },
      {
        STRIPE_CATALOG_MODE: 'TEST',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET_TEST: 'test-secret',
      },
      {
        STRIPE_CATALOG_MODE: 'live',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET_TEST: 'test-secret',
      },
      {
        STRIPE_CATALOG_MODE: 'test',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
      },
      {
        STRIPE_CATALOG_MODE: 'test',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET_TEST: '',
      },
      {
        STRIPE_CATALOG_MODE: 'test',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET: 'legacy-secret',
        STRIPE_WEBHOOK_SECRET_LIVE: 'live-secret',
      },
      {
        STRIPE_CATALOG_MODE: 'test',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET_TEST: '   ',
      },
      {
        STRIPE_CATALOG_MODE: 'test',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET_TEST: ' test-secret ',
      },
    ]) {
      expect(resolveStripeWebhookRuntimeConfig(environment)).toEqual({
        enabled: false,
        reason: 'misconfigured',
      })
    }
  })

  test('enables only exact Test configuration', () => {
    expect(
      resolveStripeWebhookRuntimeConfig({
        STRIPE_CATALOG_MODE: 'test',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET_TEST: 'test-endpoint-secret',
      })
    ).toEqual({
      enabled: true,
      mode: 'TEST',
      secret: 'test-endpoint-secret',
    })
  })

  test('disabled mode reads no secret or catalog configuration', () => {
    const reads: string[] = []
    const environment = new Proxy(
      { STRIPE_WEBHOOK_INTAKE_MODE: 'disabled' },
      {
        get: (target, property) => {
          const key = String(property)
          reads.push(key)
          if (key !== 'STRIPE_WEBHOOK_INTAKE_MODE') {
            throw new Error('disabled configuration read beyond its mode')
          }
          return Reflect.get(target, property)
        },
      }
    )
    expect(resolveStripeWebhookRuntimeConfig(environment)).toEqual({
      enabled: false,
      reason: 'disabled',
    })
    expect(reads).toEqual(['STRIPE_WEBHOOK_INTAKE_MODE'])
  })

  test('never reads legacy or Live signing-secret keys', () => {
    const reads: string[] = []
    const environment = new Proxy(
      {
        STRIPE_CATALOG_MODE: 'test',
        STRIPE_WEBHOOK_INTAKE_MODE: 'test',
        STRIPE_WEBHOOK_SECRET: 'legacy-secret',
        STRIPE_WEBHOOK_SECRET_LIVE: 'live-secret',
        STRIPE_WEBHOOK_SECRET_TEST: 'test-endpoint-secret',
      },
      {
        get: (target, property) => {
          reads.push(String(property))
          return Reflect.get(target, property)
        },
      }
    )
    expect(resolveStripeWebhookRuntimeConfig(environment).enabled).toBeTrue()
    expect(reads).not.toContain('STRIPE_WEBHOOK_SECRET')
    expect(reads).not.toContain('STRIPE_WEBHOOK_SECRET_LIVE')
  })
})
