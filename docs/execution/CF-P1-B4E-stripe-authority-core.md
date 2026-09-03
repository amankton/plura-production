# CF-P1-B4E — Stripe authority core

## Checkpoint

- Parent: `4a2536627999c03f07f0062542bae64d8067131e`
- Branch: `codex/crewframe-foundation`
- Architect entry decision: `GO_B4E_STRIPE_AUTHORITY_CORE`
- Implementation SHA: pending immutable seal
- Independent verifier: pending immutable SHA
- Production readiness: **FAIL** (intentional; see blockers)

## Scope

B4E closes the authenticated browser-to-Stripe authority paths without changing
the Prisma schema, dependency graph, lockfile, deployed environment, or Stripe
account state. No external Stripe request was made during this checkpoint.

The browser may select only an internal agency, subaccount, or funnel resource,
a logical Crewframe plan, and a per-attempt UUID for financial mutations. Funnel
configuration may propose a bounded set of Price candidates, but the server
re-retrieves and validates every Price inside the stored connected account before
persisting the cart. Checkout never treats browser Price data as authority. The
server derives Stripe Customer, Subscription, connected Account, mode, quantity,
and platform fee values after resolving the authenticated tenant context.

## Role contract

| Operation | Allowed roles |
| --- | --- |
| Create/repair agency Customer | `AGENCY_OWNER` |
| Create/change agency Subscription | `AGENCY_OWNER` |
| Agency billing and charge history | `AGENCY_OWNER` |
| Agency connected metrics | `AGENCY_OWNER`, `AGENCY_ADMIN` |
| Subaccount catalog, metrics, authenticated checkout | `AGENCY_OWNER`, `AGENCY_ADMIN`, authorized `SUBACCOUNT_USER` |
| Configure a funnel's verified connected-account Price set | `AGENCY_OWNER`, `AGENCY_ADMIN`, authorized `SUBACCOUNT_USER` |
| Subaccount profile management/deletion | `AGENCY_OWNER`, `AGENCY_ADMIN` |
| Any Stripe operation by `SUBACCOUNT_GUEST` | Denied |
| Attach a connected Stripe account | Disabled pending signed OAuth replacement |

## Implemented controls

- Strict request DTOs reject unknown keys and all caller-supplied provider IDs,
  prices, fees, modes, quantities, roles, timestamps, and provider-owned fields.
- Agency and tenant contexts run before provider reads or mutations. Stored
  provider identifiers are syntax checked and resource associations are checked
  again before Stripe is called.
- Agency Customers carry `crewframeAgencyId`; legacy unbound Customers may be
  repaired only when their stored email exactly matches the authenticated agency.
- Existing Stripe Subscriptions must belong to the agency's stored Customer
  before plan changes are attempted.
- Every Stripe POST uses a stable, namespaced idempotency key derived from an
  internal resource and a browser-generated operation UUID.
- Connected Checkout loads the published funnel and bounded stored cart, then
  retrieves each Price in the stored connected account. It rejects malformed,
  inactive, duplicate, mixed-mode, recurring-mismatch, non-USD, or extra prices.
  Quantity is fixed at one and fees are validated server-only configuration.
- The only funnel-product writer is a strict `commerce:configure` action. It
  authorizes the funnel's derived subaccount, verifies every proposed Price under
  the stored connected account, and conditionally updates by both funnel and
  subaccount IDs. The generic funnel profile command cannot write `liveProducts`.
- Checkout uses `crewframe_funnel_checkout_v1_` plus eight deterministic
  lowercase letters derived from the random operation UUID as
  `integration_identifier`. The suffix remains stable for an idempotent retry.
- Authenticated mutation routes require JSON and the exact configured application
  Origin. They reject cross-site fetch metadata, enforce a 16 KiB header limit,
  and incrementally read/cancel the body at 16 KiB even when Content-Length is
  missing or false. Provider failures become generic responses with a sanitized
  correlation ID.
- Reflected CORS and the Checkout `OPTIONS` handler were removed. The literal
  public allowlist remains `['/site', '/api/uploadthing']`; Checkout and webhook
  remain protected.
- Stripe.js instances are cached separately for the platform and each exact
  server-derived connected account.
- Page-render OAuth code exchange, unsigned state redirects, and the raw
  connected-account server action were removed. Connect controls are disabled.
- Legacy agency/subaccount profile actions now use strict allowlists and direct
  owner/operator checks. Provider-owned IDs are preserved on update and forced
  empty on create. Agency creation and actor attachment are transactionally
  claimed to prevent concurrent orphan-agency creation.
- Webhook subscription synchronization is internal `server-only` code and no
  longer swallows persistence failures. The webhook is deliberately not public.

## Verification

- `bun install --frozen-lockfile`: pass; no changes.
- `bun run lint`: pass.
- `bun run typecheck`: pass.
- Focused account/auth/Stripe tests: pass.
- Complete `bun test`: 194 passed, 0 failed, 781 expectations.
- `bun run build`: pass; all application routes compiled and page generation
  completed.
- `bunx prisma validate` with a process-local placeholder URL: pass.
- `git diff --check`: pass (Windows line-ending notices only).
- Package, lockfile, and Prisma schema diff against the parent: empty.
- Secret-pattern filename scan: clear.
- `bun audit`: 63 inherited advisories (34 high, 25 moderate, 4 low); no
  dependency was changed in this schema-neutral checkpoint.

## Deliberate exclusions and blockers

B4E is not deployable. The next checkpoints must address all of the following:

1. Establish a representative database/migration baseline, run the B4D logical
   plan preflight, and apply/backfill the additive migration safely.
2. Add a durable Stripe webhook receipt/inbox with unique account+event identity,
   retry state, convergent out-of-order handling, replay tooling, and a staging
   rehearsal. Only then may the webhook enter the public allowlist.
3. Replace Connect OAuth with a dedicated callback using expiring, signed,
   actor/resource-bound state; reconcile and attest historically stored connected
   account associations.
4. Design public anonymous funnel Checkout separately with a trusted custom-domain
   origin registry, rate limiting/bot controls, consent, and fulfillment policy.
5. Add durable reconciliation/outbox handling for Stripe Customer creation versus
   the local conditional attach, including orphan-customer recovery beyond
   Stripe's idempotency retention window.
6. Verify Test Mode credentialed Customer, subscription, plan-change, connected
   Checkout, and failure/retry flows. Live Mode remains untouched and unapproved.
7. Define and test a Stripe.js-compatible Content Security Policy before public
   payment collection.
8. Resolve or explicitly accept the inherited dependency advisories before a
   production release.
9. Stripe Tax remains disabled. Tax registrations, jurisdictions, product tax
   codes, prices, customer locations, and filing obligations require business and
   qualified tax review before enabling automatic tax.

## Rollback

B4E contains no provider, schema, migration, data, or deployment mutation. Its
code changes can be reverted as one implementation checkpoint; the B4D Test Mode
catalog remains independent.
