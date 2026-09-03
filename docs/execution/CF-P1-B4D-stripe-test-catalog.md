# CF-P1-B4D — Stripe Test Catalog and Logical Plans

Status: implementation complete; verification pending
Branch: `codex/crewframe-foundation`
Parent checkpoint: `e3a595ddd2a1c9f1ac23787460bb7f13efa52e44`
Implementation commit: pending
Verified candidate: pending
Date: 2026-09-03

## Objective

Create the initial Crewframe subscription catalog in Stripe Test Mode and wire
the application to stable logical plan identities without coupling runtime
behavior or the database schema to environment-specific Stripe object IDs.

## Decision

Crewframe uses two paid logical plans: `BASIC` and `UNLIMITED`. The application
resolves those plans on the server through stable Stripe Price lookup keys and
strictly verifies the returned Price terms. The exact provider Price ID remains
stored on each subscription for traceability, but it is never accepted as the
browser's plan selector.

The schema change follows an expand-and-contract sequence. The legacy
provider-ID enum and field remain readable, and a nullable logical-plan column
is added in a staging-only SQL draft. No schema or data mutation has been
applied because this checkout has no database connection or established Prisma
migration baseline.

## Stripe Test Mode catalog

Stripe account: `acct_1SPUmeFHOTtuzKF5` (`New business`)

- Crewframe Basic
  - Product: `prod_VC4yjRcVfd93AP`
  - Price: `price_1UBgp3FHOTtuzKF5PQ6ZkvPh`
  - Lookup key: `crewframe_basic_monthly`
  - Terms: USD 49.00 per month, licensed, active
- Crewframe Unlimited
  - Product: `prod_VC4yXR9Lpd9Mot`
  - Price: `price_1UBgp8FHOTtuzKF5k2ifW6Gj`
  - Lookup key: `crewframe_unlimited_monthly`
  - Terms: USD 199.00 per month, licensed, active

The two active prices use separate active products and are each the default
price of their product. Both objects report `livemode: false`.

An initial combined Test product (`prod_VC4xojv7sxW5PT`) and its two prices
(`price_1UBgoAFHOTtuzKF57zAGpRo0` and
`price_1UBgoEFHOTtuzKF59htXsyRo`) were created before the product-per-tier rule
was identified. That product and both prices were made inactive, their lookup
keys were moved away from the active catalog, and the product's default price
was cleared. No Live Mode object was read as catalog authority or mutated.

## Implemented guarantees

- The browser and query string use only `BASIC` or `UNLIMITED`; callers cannot
  submit a raw Stripe Product or Price ID as the selected plan.
- The server lists active recurring Prices by the two stable lookup keys and
  requires exactly one valid result for each logical plan.
- Catalog loading fails closed for missing, duplicate, inactive, deleted,
  shared-product, wrong-mode, wrong-currency, wrong-amount, non-monthly, or
  metered entries.
- Public pricing and agency billing receive only client-safe plan, interval,
  and amount data. Provider IDs stay server-side.
- Signed subscription lifecycle events map the complete Stripe Price terms to
  a logical plan and persist both the logical plan and exact provider Price ID.
- The obsolete single-product environment variable and unverified Priority
  Support Product ID are removed from active runtime selection.
- `STRIPE_CATALOG_MODE=test|live` is explicit and server-only. The current
  example defaults to `test`; no Live catalog object is embedded in source.
- A read-only migration preflight reports legacy mappings, nulls, unknowns,
  conflicts, and active subscriptions whose current Price cannot be verified.
  It prints no provider Price identifiers and performs no writes.
- No secret key, publishable key, webhook secret, customer data, payment
  method, or card data was written to the repository or this record.

## Primary references

- Stripe Price lookup keys:
  <https://docs.stripe.com/products-prices/manage-prices?dashboard-or-api=api>
- Stripe Price list API:
  <https://docs.stripe.com/api/prices/list?lang=node>
- Stripe subscription integration design:
  <https://docs.stripe.com/billing/subscriptions/design-an-integration.md>
- Stripe webhook signature verification:
  <https://docs.stripe.com/webhooks.md#verify-events>
- Stripe Billing tax collection:
  <https://docs.stripe.com/billing/taxes/collect-taxes.md>

## Verification

- Stripe Test Mode inventory: passed after connector reauthorization. Exactly
  two active products and two active recurring prices were returned, matching
  the IDs, lookup keys, amounts, intervals, defaults, and product separation
  recorded above.
- `bun install --frozen-lockfile`: passed; 895 installs across 705 packages,
  no changes.
- `bun run verify`: passed.
  - ESLint: zero warnings or errors.
  - TypeScript: passed.
  - Bun: 121 tests, 576 expectations, zero failures.
  - Next.js 14.2.35 production build: passed.
- Focused Stripe tests: 15 passed, 71 expectations, zero failures.
- `prisma validate`: passed with a process-local placeholder connection string;
  no database connection was attempted.
- Repository secret scan found no Stripe secret, restricted, or webhook key.
- `bun audit`: 63 inherited advisories (34 high, 25 moderate, 4 low); no
  dependency changed in this catalog batch.
- `git diff --check`: passed; line-ending notices only.
- `bun run preflight:subscription-plans`: failed closed because no `.env` or
  database connection exists in this checkout. No data was changed.
- Agency architect final review: `GO_B4D_FINAL` after one required correction
  preserved the legacy plan field during webhook synchronization.
- Independent verifier: pending.

## Explicit exclusions and blockers

- This remains a non-deployable checkpoint. Stripe mutation routes still need
  server-derived customer and tenant authority before real customer use.
- `/api/stripe/webhook` remains protected by Clerk middleware and has no
  durable event-idempotency ledger. No Stripe webhook endpoint was created.
- The migration SQL is a staging draft only. A database preflight, backup,
  migration baseline, staging rehearsal, backfill, and later contract migration
  are still required.
- No Live Mode Product, Price, webhook, or secret was created or configured.
- Priority Support pricing is undefined, so that add-on remains disabled.
- Customer Portal, Smart Retries, automated billing email, and Connect Accounts
  v2/direct charges remain deferred.
- Stripe Tax is not enabled. Customer geography, tax registrations, product tax
  codes, and professional tax review must be resolved before automatic tax is
  turned on or taxable customers are charged.
- No credentialed Payment Element, subscription create/change, webhook replay,
  or connected-account smoke test was performed.
- Existing dependency advisories and inherited production blockers remain open.

## Rollback

Revert the B4D implementation commit once recorded below. The inactive Stripe
Test objects may remain archived for auditability; the two active Test products
and prices can be archived separately if the catalog itself must be rolled
back. There is no schema or data migration to reverse in this checkpoint.
