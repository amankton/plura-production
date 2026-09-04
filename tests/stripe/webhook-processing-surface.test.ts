import { describe, expect, test } from 'bun:test'

describe('B4F2A2 local processor worker surface', () => {
  test('keeps A2 unwired from routes, scheduling, and provider transports', async () => {
    const [core, composition, worker, route, routing] = await Promise.all([
      Bun.file('src/lib/stripe/prisma-webhook-processing-store-core.ts').text(),
      Bun.file('src/lib/stripe/prisma-webhook-processing-store.ts').text(),
      Bun.file('src/lib/stripe/webhook-worker.ts').text(),
      Bun.file('src/app/api/stripe/webhook/route.ts').text(),
      Bun.file('src/lib/routing/middleware-routing.ts').text(),
    ])
    const a2 = `${core}\n${composition}\n${worker}`
    expect(composition).toStartWith("import 'server-only'")
    expect(a2).not.toMatch(
      /getStripeServerClient|from ['"]stripe['"]|fetch\(|axios|http:\/\/|https:\/\//
    )
    expect(a2).not.toMatch(
      /setInterval|setTimeout|cron|scheduler|console\.(?:debug|error|info|log|warn)/
    )
    expect(route).not.toContain('webhook-worker')
    expect(route).not.toContain('prisma-webhook-processing-store')
    expect(routing).toContain("PUBLIC_ROUTES = ['/site', '/api/uploadthing']")
    expect(routing).not.toContain('/api/stripe/webhook')
  })

  test('keeps replay and the accepted A1 response matrix disconnected', async () => {
    const [worker, routeHandler] = await Promise.all([
      Bun.file('src/lib/stripe/webhook-worker.ts').text(),
      Bun.file('src/lib/stripe/webhook-route-handler.ts').text(),
    ])
    expect(worker).not.toContain('webhook-replay')
    expect(routeHandler).toContain("isTerminalWebhookStatus(result.receipt.status)")
    expect(routeHandler).toContain("jsonResponse(503, 'webhook_receipt_pending')")
  })
})
