# CF-P1-B4C1 — Stripe Server SDK Upgrade

Status: implemented; pending independent verification
Branch: `codex/crewframe-foundation`
Parent checkpoint: `42836265a826397c14a4b141eac94fb385a14cdf`
Implementation commit: pending
Verified candidate: pending
Date: 2026-09-03

## Objective

Upgrade the Stripe server SDK to its current typed API in an isolated leaf while
freezing the browser Stripe pair, framework, identity, upload, schema, data, and
Crewframe design surfaces.

## Decision

Only `stripe` moves, from `14.25.0` to exactly `22.6.1`. The server client pins
Stripe API version `2026-08-26.dahlia`, which is the API version bundled with
that SDK release. `@stripe/react-stripe-js` and `@stripe/stripe-js` remain on
their existing versions for a separate client migration.

Stripe's Basil API removed the old Invoice `payment_intent` field and introduced
the expandable `confirmation_secret` field for Payment Element integrations.
Subscription create and update calls now expand
`latest_invoice.confirmation_secret` and strictly extract its client secret.

## Scope and implemented guarantees

- `stripe` is exactly `22.6.1`; `bun pm why stripe` resolves only that direct
  dependency.
- The lazy server-only Stripe factory pins API version
  `2026-08-26.dahlia` and fails closed when `STRIPE_SECRET_KEY` is absent.
  Merely importing the module no longer requires credentials, so
  credentialless builds remain reproducible.
- All server call sites use the lazy factory. No Stripe server client can be
  imported into a Client Component.
- Subscription synchronization derives the customer, price, subscription ID,
  and item-level period from one validated recurring subscription item.
- Only price IDs represented by the Prisma `Plan` enum can be persisted.
- Created, updated, and deleted subscription events are discriminated before
  their payload is handled; unrelated Stripe event objects are ignored.
- Runtime guards validate unknown event objects, customer references,
  string-only metadata, item periods, and recurring price shapes without
  migration casts or TypeScript suppressions.
- Invoice confirmation secrets require a non-deleted expanded Invoice object
  and a nonblank `confirmation_secret.client_secret`.
- Account retrieval calls use the Stripe 22 signature. Product rendering uses
  one typed expanded-price helper instead of suppressing type errors.
- No Stripe route was added to the public middleware allowlist.
- No live Stripe request, credential, schema migration, or data mutation was
  performed.

## Primary references

- Stripe Node v22 migration guide:
  <https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v22>
- Stripe Node v22.6.1 changelog:
  <https://github.com/stripe/stripe-node/blob/v22.6.1/CHANGELOG.md>
- Stripe API versioning:
  <https://docs.stripe.com/api/versioning?lang=node>
- Stripe Invoice `confirmation_secret` reference:
  <https://docs.stripe.com/api/invoices/object?lang=node>
- Stripe Basil Invoice payment changes:
  <https://docs.stripe.com/changelog/basil/2025-03-31/add-support-for-multiple-partial-payments-on-invoices>

## Version and security evidence

- `bun pm why stripe`: only `stripe@22.6.1`, required directly by the app.
- `bun pm why qs`: no matching package in the lockfile.
- `bun audit` improved from 67 advisories to 63:
  - critical: 0 to 0
  - high: 34 to 34
  - moderate: 28 to 25
  - low: 5 to 4
- `package.json` differs from the parent only at the direct `stripe` version.
- `prisma/schema.prisma` is unchanged from the parent checkpoint.

## Verification

- Agency architect: `GO_B4C1_SERVER_ONLY` before implementation; final-diff
  review pending.
- Independent verifier: pending.
- `bun install --frozen-lockfile`: passed; 895 installs across 705 packages,
  no changes.
- `bun run verify`: passed.
  - ESLint: zero warnings or errors.
  - TypeScript: passed.
  - Bun: 113 tests, 536 expectations, zero failures.
  - Next.js 14.2.35 production build: passed, including static generation and
    build traces without Stripe credentials.
- Focused Stripe and dependency-surface tests: 11 passed, 58 expectations,
  zero failures.
- `git diff --check`: passed; line-ending notices only.

## Explicit exclusions and blockers

- The Stripe mutation routes still accept agency, account, customer, and price
  selectors without complete server-derived tenant authority. That lockdown is
  required before deployment and is deliberately excluded from this dependency
  leaf.
- `/api/stripe/webhook` remains protected by Clerk middleware, so Stripe cannot
  currently deliver to it. Making it public requires a dedicated batch that
  couples signature enforcement with durable event idempotency; this upgrade
  does not loosen the route.
- Webhook processing has no durable replay/idempotency ledger yet.
- The browser Stripe singleton can retain the first connected-account context;
  that concern belongs to the later Stripe browser/client batch.
- No credentialed Stripe Test Mode subscription, update, webhook, connected
  account, or Payment Element flow was executed. Those smoke tests remain
  mandatory after authority and webhook work.
- The remaining 63 advisories, current Next.js findings, and all inherited
  production blockers remain open. This is a non-deployable checkpoint.
- No Odoo or Composio integration, agent runtime, Prisma schema/data, design
  token, font, color, copy, or layout changed.

## Rollback

Revert the B4C1 implementation commit to return to
`42836265a826397c14a4b141eac94fb385a14cdf`. This checkpoint has no schema,
data, environment-variable, or external credential migration to reverse.
