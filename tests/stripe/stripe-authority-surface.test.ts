import { describe, expect, test } from 'bun:test'

describe('Stripe authority surface', () => {
  test('accepts internal selectors only at browser mutation boundaries', async () => {
    const [
      customerRoute,
      subscriptionRoute,
      checkoutRoute,
      subscriptionClient,
      checkoutClient,
    ] = await Promise.all([
      Bun.file('src/app/api/stripe/create-customer/route.ts').text(),
      Bun.file('src/app/api/stripe/create-subscription/route.ts').text(),
      Bun.file('src/app/api/stripe/create-checkout-session/route.ts').text(),
      Bun.file(
        'src/components/forms/subscription-form/subscription-form-wrapper.tsx'
      ).text(),
      Bun.file(
        'src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor/funnel-editor-components/checkout.tsx'
      ).text(),
    ])

    expect(customerRoute).toContain('ensureAgencyCustomer')
    expect(customerRoute).toContain('readTrustedJsonRequest')
    expect(customerRoute).not.toContain('customerId')
    expect(subscriptionRoute).toContain('createOrChangeSubscription')
    expect(subscriptionRoute).toContain('readTrustedJsonRequest')
    expect(subscriptionRoute).not.toContain('customerId')
    expect(checkoutRoute).toContain('createAuthenticatedFunnelCheckout')
    expect(checkoutRoute).toContain('readTrustedJsonRequest')
    expect(checkoutRoute).not.toContain('Access-Control-Allow-Origin')
    expect(checkoutRoute).not.toContain('export async function OPTIONS')

    expect(subscriptionClient).toContain('agencyId')
    expect(subscriptionClient).toContain('operationId')
    expect(subscriptionClient).not.toContain('customerId')
    expect(checkoutClient).toContain("'/api/stripe/create-checkout-session'")
    expect(checkoutClient).toContain('operationId')
    expect(checkoutClient).not.toContain('prices: livePrices')
    expect(checkoutClient).not.toContain('getSubaccountDetails')
  })

  test('quarantines OAuth and raw server-action provider selectors', async () => {
    const [
      agencyLaunchpad,
      subaccountLaunchpad,
      agencyEntry,
      subaccountEntry,
      utils,
      actions,
    ] =
      await Promise.all([
        Bun.file('src/app/(main)/agency/[agencyId]/launchpad/page.tsx').text(),
        Bun.file(
          'src/app/(main)/subaccount/[subaccountId]/launchpad/page.tsx'
        ).text(),
        Bun.file('src/app/(main)/agency/page.tsx').text(),
        Bun.file('src/app/(main)/subaccount/page.tsx').text(),
        Bun.file('src/lib/utils.ts').text(),
        Bun.file('src/features/commerce/actions.ts').text(),
      ])
    const oauthSurface = [
      agencyLaunchpad,
      subaccountLaunchpad,
      agencyEntry,
      subaccountEntry,
      utils,
    ].join('\n')

    expect(oauthSurface).not.toContain('stripe.oauth.token')
    expect(oauthSurface).not.toContain('getStripeOAuthLink')
    expect(oauthSurface).not.toContain('searchParams.state')
    expect(agencyLaunchpad).toContain('Secure reconnect coming soon')
    expect(subaccountLaunchpad).toContain('Secure reconnect coming soon')
    expect(await Bun.file('src/lib/stripe/stripe-actions.ts').exists()).toBe(false)
    expect(actions).toContain('listConnectedProducts(subaccountId)')
    expect(actions).toContain('configureFunnelProducts(input)')
    expect(actions).not.toContain('stripeAccount')
    expect(await Bun.file('src/lib/queries.ts').text()).not.toContain(
      'updateFunnelProducts'
    )
  })

  test('puts idempotency and ownership checks on every Stripe mutation adapter', async () => {
    const [billingServer, commerceServer] = await Promise.all([
      Bun.file('src/features/billing/server-billing-service.ts').text(),
      Bun.file('src/features/commerce/server-commerce-service.ts').text(),
    ])

    expect(billingServer).toContain(
      'metadata: { crewframeAgencyId: agencyId }'
    )
    expect(billingServer).toContain(
      'metadata: { crewframeAgencyId: profile.id }'
    )
    expect(billingServer).toContain(
      'stripeReferenceId(current.customer) !== customerId'
    )
    expect(billingServer.match(/\{ idempotencyKey \}/g)?.length).toBe(4)
    expect(commerceServer).toContain(
      '{ idempotencyKey, stripeAccount: connectedAccountId }'
    )
  })

  test('never performs an unfiltered agency charge query', async () => {
    const [billingPage, billingServer] = await Promise.all([
      Bun.file('src/app/(main)/agency/[agencyId]/billing/page.tsx').text(),
      Bun.file('src/features/billing/server-billing-service.ts').text(),
    ])

    expect(billingPage).toContain('listAgencyCharges')
    expect(billingPage).not.toContain('stripe.charges.list')
    expect(billingServer).toContain('charges.list({')
    expect(billingServer).toContain('customer: customerId')
  })

  test('keeps Stripe endpoints protected and provider configuration server-only', async () => {
    const [routing, env, commerceServer, sync] = await Promise.all([
      Bun.file('src/lib/routing/middleware-routing.ts').text(),
      Bun.file('.env.example').text(),
      Bun.file('src/features/commerce/server-commerce-service.ts').text(),
      Bun.file('src/lib/stripe/subscription-sync.ts').text(),
    ])

    expect(routing).toContain("PUBLIC_ROUTES = ['/site', '/api/uploadthing']")
    expect(routing).not.toContain('/api/stripe')
    expect(env).not.toContain('NEXT_PUBLIC_PLATFORM_')
    expect(env).toContain('STRIPE_PLATFORM_SUBSCRIPTION_PERCENT')
    expect(env).toContain('STRIPE_PLATFORM_ONETIME_FEE_CENTS')
    expect(commerceServer).toContain('integration_identifier')
    expect(commerceServer).not.toContain('payment_method_types')
    expect(sync.startsWith("import 'server-only'")).toBe(true)
    expect(sync).not.toContain("'use server'")
    expect(sync).not.toContain('catch')
  })

  test('removes provider-owned agency fields from the profile command', async () => {
    const [form, subaccountForm, queries, schema, subaccountSchema] =
      await Promise.all([
      Bun.file('src/components/forms/agency-details.tsx').text(),
      Bun.file('src/components/forms/subaccount-details.tsx').text(),
      Bun.file('src/lib/queries.ts').text(),
      Bun.file('src/features/accounts/agency-profile.ts').text(),
      Bun.file('src/features/accounts/subaccount-profile.ts').text(),
    ])
    expect(form).toContain('agencyId: response.id')
    expect(form).not.toContain('customerId: data?.customerId')
    expect(queries).toContain('agencyProfileInputSchema.parse')
    expect(queries).toContain("customerId: ''")
    expect(queries).toContain("connectAccountId: ''")
    expect(schema).not.toContain('customerId')
    expect(schema).not.toContain('connectAccountId')
    expect(schema).not.toContain('companyEmail')
    expect(subaccountForm).not.toContain("connectAccountId: ''")
    expect(subaccountSchema).not.toContain('connectAccountId')
    expect(subaccountSchema).not.toContain('goal')
    expect(queries).not.toContain('Partial<Agency>')
    expect(queries).not.toContain('subAccount: SubAccount')
    expect(queries).not.toContain('getSubaccountDetails')
  })
})
