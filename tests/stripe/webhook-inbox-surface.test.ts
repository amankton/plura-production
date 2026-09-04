import { describe, expect, test } from 'bun:test'

describe('B4F webhook inbox surface', () => {
  test('keeps the runtime processor and public allowlist disconnected', async () => {
    const [route, routing] = await Promise.all([
      Bun.file('src/app/api/stripe/webhook/route.ts').text(),
      Bun.file('src/lib/routing/middleware-routing.ts').text(),
    ])
    expect(route).toContain('webhook-intake')
    expect(route).not.toContain('webhook-processor')
    expect(route).not.toContain('subscription-sync')
    expect(routing).toContain("PUBLIC_ROUTES = ['/site', '/api/uploadthing']")
    expect(routing).not.toContain('/api/stripe/webhook')
  })

  test('defines additive receipt, object lease, and replay audit targets', async () => {
    const [schema, sql] = await Promise.all([
      Bun.file('prisma/schema.prisma').text(),
      Bun.file(
        'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql'
      ).text(),
    ])
    for (const model of [
      'StripeWebhookReceipt',
      'StripeWebhookObjectLease',
      'StripeWebhookReplayAudit',
    ]) {
      expect(schema).toContain(`model ${model}`)
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS \`${model}\``)
    }
    expect(schema).toContain('@@unique([mode, accountScopeKey, eventId]')
    expect(schema).toContain(
      '@@unique([mode, accountScopeKey, objectType, objectId]'
    )
    for (const field of [
      'accountScopeKey',
      'eventId',
      'eventType',
      'providerCreatedAt',
      'payloadHash',
      'attempts',
      'leaseToken',
      'leaseExpiresAt',
      'nextRetryAt',
      'lastErrorCode',
      'lastErrorMessage',
      'retentionExpiresAt',
      'completedAt',
    ]) {
      expect(schema).toContain(field)
      expect(sql).toContain(`\`${field}\``)
    }
    for (const status of [
      'RECEIVED',
      'PROCESSING',
      'RETRY_PENDING',
      'SUCCEEDED',
      'IGNORED',
      'DEAD_LETTER',
    ]) {
      expect(schema).toContain(status)
      expect(sql).toContain(`'${status}'`)
    }
    expect(sql).not.toMatch(/`(?:rawBody|rawHeaders|payload|signature|secret)`/i)
    expect(sql).not.toMatch(/\b(?:ALTER|DELETE|DROP|TRUNCATE|UPDATE)\b/i)
  })

  test('does not introduce an applyable Prisma migration', async () => {
    const glob = new Bun.Glob('prisma/migrations/**/*')
    const migrations = Array.from(glob.scanSync({ cwd: '.' }))
    expect(migrations).toEqual([])
  })

  test('keeps Stripe and package versions unchanged for this checkpoint', async () => {
    const manifest = await Bun.file('package.json').json()
    expect(manifest.dependencies.stripe).toBe('22.6.1')
    expect(manifest.dependencies['@stripe/stripe-js']).toBe('^2.4.0')
    expect(manifest.dependencies['@stripe/react-stripe-js']).toBe('^2.9.0')
  })

  test('exposes only bounded observations and performs no direct logging', async () => {
    const sources = await Promise.all([
      Bun.file('src/lib/stripe/webhook-inbox-contract.ts').text(),
      Bun.file('src/lib/stripe/webhook-intake.ts').text(),
      Bun.file('src/lib/stripe/webhook-processor.ts').text(),
      Bun.file('src/lib/stripe/webhook-replay.ts').text(),
    ])
    expect(sources.join('\n')).not.toMatch(/console\.(?:debug|error|info|log|warn)/)
    expect(sources[0]).toContain("stage: 'intake' | 'processing'")
    expect(sources[0]).not.toContain('rawBody?:')
    expect(sources[0]).not.toContain('secret?:')
  })
})
