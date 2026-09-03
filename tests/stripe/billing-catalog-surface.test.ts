import { describe, expect, test } from 'bun:test'

describe('Crewframe Stripe catalog surface', () => {
  test('keeps provider IDs out of runtime plan selection', async () => {
    const [constants, publicPricing, billingPage, subscriptionRoute, env] =
      await Promise.all([
        Bun.file('src/lib/constants.ts').text(),
        Bun.file('src/app/site/page.tsx').text(),
        Bun.file('src/app/(main)/agency/[agencyId]/billing/page.tsx').text(),
        Bun.file('src/app/api/stripe/create-subscription/route.ts').text(),
        Bun.file('.env.example').text(),
      ])
    const runtime = [constants, publicPricing, billingPage, subscriptionRoute].join(
      '\n'
    )

    expect(runtime).not.toMatch(/price_1OYxkqFj9oKEERu1/)
    expect(runtime).not.toMatch(/price_1UBgp/)
    expect(runtime).not.toMatch(/prod_VC4y/)
    expect(runtime).not.toContain('NEXT_PLURA_PRODUCT_ID')
    expect(env).not.toContain('NEXT_PLURA_PRODUCT_ID')
    expect(env).toContain('STRIPE_CATALOG_MODE=test')
  })

  test('accepts logical plans and resolves the provider price on the server', async () => {
    const [route, billingServer, catalogServer] = await Promise.all([
      Bun.file('src/app/api/stripe/create-subscription/route.ts').text(),
      Bun.file('src/features/billing/server-billing-service.ts').text(),
      Bun.file('src/lib/stripe/billing-catalog-server.ts').text(),
    ])

    expect(route).toContain('createOrChangeSubscription')
    expect(route).not.toContain('customerId')
    expect(billingServer).toContain('getCrewframePriceForPlan(plan)')
    expect(catalogServer).toContain('lookup_keys: crewframePriceLookupKeys')
    expect(catalogServer).toContain("expand: ['data.product']")
    expect(catalogServer).toContain('productIds.has(product.id)')
    expect(catalogServer).toContain('STRIPE_CATALOG_MODE')
  })

  test('uses an additive logical plan migration and preserves legacy data', async () => {
    const [schema, migration, webhookActions] = await Promise.all([
      Bun.file('prisma/schema.prisma').text(),
      Bun.file(
        'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql'
      ).text(),
      Bun.file('src/lib/stripe/subscription-sync.ts').text(),
    ])

    expect(schema).toContain('enum LegacyPlan')
    expect(schema).toContain('enum Plan')
    expect(schema).toContain('logicalPlan Plan?')
    expect(migration).toContain('ADD COLUMN `logicalPlan`')
    expect(migration).not.toContain('UPDATE `Subscription`')
    expect(migration).not.toContain('DROP COLUMN')
    expect(webhookActions).toContain('logicalPlan:')
    expect(webhookActions).not.toContain('plan: null')
  })
})
