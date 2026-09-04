import { describe, expect, test } from 'bun:test'

describe('B4F2A1 private webhook intake surface', () => {
  test('keeps the route Node-only, private, bounded, and processor-free', async () => {
    const [route, handler, routing] = await Promise.all([
      Bun.file('src/app/api/stripe/webhook/route.ts').text(),
      Bun.file('src/lib/stripe/webhook-route-handler.ts').text(),
      Bun.file('src/lib/routing/middleware-routing.ts').text(),
    ])
    expect(route).toContain("export const runtime = 'nodejs'")
    expect(route).toContain('handleStripeWebhookRoute')
    expect(route).toContain('prisma-webhook-intake-store')
    expect(`${route}\n${handler}`).not.toMatch(/\.text\(\)/)
    expect(`${route}\n${handler}`).not.toMatch(
      /webhook-processor|webhook-replay|subscription-sync|synchronizeSubscription/
    )
    expect(`${route}\n${handler}`).not.toMatch(
      /console\.(?:debug|error|info|log|warn)/
    )
    expect(routing).toContain("PUBLIC_ROUTES = ['/site', '/api/uploadthing']")
    expect(routing).not.toContain('/api/stripe/webhook')
  })

  test('marks secret/configuration and Prisma composition as server-only', async () => {
    const [config, store] = await Promise.all([
      Bun.file('src/lib/stripe/webhook-runtime-config.ts').text(),
      Bun.file('src/lib/stripe/prisma-webhook-intake-store.ts').text(),
    ])
    expect(config).toStartWith("import 'server-only'")
    expect(store).toStartWith("import 'server-only'")
  })

  test('contains no Live or legacy signing-secret fallback in runtime source', async () => {
    const sources = await Promise.all([
      Bun.file('src/app/api/stripe/webhook/route.ts').text(),
      Bun.file('src/lib/stripe/webhook-runtime-config.ts').text(),
      Bun.file('src/lib/stripe/webhook-runtime-config-contract.ts').text(),
      Bun.file('src/lib/stripe/webhook-route-handler.ts').text(),
    ])
    expect(sources.join('\n')).not.toContain('STRIPE_WEBHOOK_SECRET_LIVE')
    expect(sources.join('\n')).not.toMatch(/STRIPE_WEBHOOK_SECRET(?!_TEST)/)
  })
})
