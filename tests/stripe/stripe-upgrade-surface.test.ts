import { describe, expect, test } from 'bun:test'

describe('Stripe 22 server SDK upgrade surface', () => {
  test('upgrades only the server SDK and freezes adjacent dependency families', async () => {
    const manifest = await Bun.file('package.json').json()

    expect(manifest.dependencies.stripe).toBe('22.6.1')
    expect(manifest.dependencies['@stripe/react-stripe-js']).toBe('^2.9.0')
    expect(manifest.dependencies['@stripe/stripe-js']).toBe('^2.4.0')
    expect(manifest.dependencies.next).toBe('14.2.35')
    expect(manifest.dependencies.react).toBe('^18.3.1')
    expect(manifest.dependencies['@clerk/nextjs']).toBe('6.39.6')
    expect(manifest.dependencies['@prisma/client']).toBe('5.22.0')
    expect(manifest.dependencies.uploadthing).toBe('6.13.3')
  })

  test('pins the typed API and removes unsafe server migration escapes', async () => {
    const clientSource = await Bun.file('src/lib/stripe/index.ts').text()
    const serverSources = await Promise.all(
      [
        'src/lib/stripe/stripe-actions.ts',
        'src/app/api/stripe/create-checkout-session/route.ts',
        'src/app/api/stripe/create-subscription/route.ts',
        'src/app/api/stripe/webhook/route.ts',
      ].map((path) => Bun.file(path).text())
    )
    const combined = serverSources.join('\n')

    expect(clientSource).toContain("apiVersion: '2026-08-26.dahlia'")
    expect(combined).not.toContain('@ts-ignore')
    expect(combined).not.toContain('as Stripe.Subscription')
    expect(combined).not.toContain('latest_invoice.payment_intent')
  })
})
