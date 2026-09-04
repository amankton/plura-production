# CF-P1-B4F2A2 — Local TEST processor/worker foundation

## Problem

B4F2A1 can persist verified TEST webhook receipts but intentionally returns
`503` for every new or nonterminal receipt. B4F1 defines the processing,
convergence, lease, retry, dead-letter, and projection domain, but no real
Prisma processing store or bounded worker drives it. Connecting an operational
worker, provider, public route, or persistent schema before the database and
runtime controls are proven would create unsafe acknowledgement and authority
boundaries.

## Goal

Prove, locally and against disposable MySQL 8.4, that B4F1's receipt claims,
per-subscription serialization, bounded retries, terminalization, and agency
subscription projection can be implemented atomically by Prisma and driven by
one explicit bounded TEST-only run. This checkpoint creates no continuously
available or externally connected runtime.

## Owner and prerequisites

- Implementation owner: Codex primary agent.
- Architecture reviewer: Crewframe Agency Architect.
- Independent verifier: Crewframe Verifier.
- Acceptance authority: Crewframe Acceptance Orchestrator.
- Accepted parent and B4F2A1 lifecycle seal:
  `8bd7805658d16a0a7587bf6a370423dd2ee3a795`.
- B4F2A1 implementation:
  `73336f38bb9877f2f1210316a721fa958ceb41e9`.
- B4F2A1 execution seal:
  `ba08406771ad6ed5a666247d84da85b9733bb91a`.
- Intake clearance: `GO_B4F2A2_INTAKE`.
- Requested Architect entry token:
  `GO_B4F2A2_LOCAL_PROCESSOR_WORKER_FOUNDATION`.
- Requested Verifier contract token: `PASS_B4F2A2_CONTRACT`.
- `CF-P1-AUDIT-FRESH-01` remains open and blocks every shared, public,
  deployed, or release-ready runtime.

## Scope

- Add a server-only Prisma implementation of B4F1's
  `WebhookProcessingStore`: `getReceipt`, `claimReceipt`, `claimObjectLease`,
  `completeIgnored`, `failReceipt`, and `projectAndComplete`.
- Add a narrow Prisma due-work source fixed to TEST mode and a bounded agency
  directory that reads at most two agencies for an exact Customer ID.
- Add a pure, injected `runOnce` worker that selects at most 25 receipt UUIDs
  and processes them sequentially through the existing
  `processStripeWebhookReceipt` domain.
- Use only deterministic, injected, fixture-backed current Subscription and
  Customer snapshots. No concrete Stripe provider reader is allowed.
- Prove the real store and multiple independent run-once invocations against
  randomly named disposable MySQL 8.4 containers using generated/synthetic
  data only.
- Add focused tests, disposable proof tooling, an execution record, and
  candidate-specific dependency continuity evidence.

## Work-discovery and worker contract

- Discovery is structurally fixed to `mode = TEST` across every account scope.
  A caller cannot select Live Mode.
- Eligible rows are `RECEIVED`, `RETRY_PENDING` with `nextRetryAt <= now`, and
  `PROCESSING` with a missing or `leaseExpiresAt <= now` lease. Equality is
  eligible for retry or reclaim.
- Terminal rows, future retries, active processing leases, and all `LIVE` rows
  are excluded.
- The explicit integer batch limit is restricted to 1 through 25. Invalid
  limits fail before store or provider access.
- Work is ordered by effective ready time, then `createdAt`, then receipt UUID.
  Provider creation time and event ID never determine processing order. No
  offset pagination is used.
- A run is sequential and finite. It contains no timer, sleep, polling loop,
  cron, detached promise, startup hook, API route, Server Action, queue service,
  or daemon/package-script registration.
- Multiple independent runs may discover the same UUID. Only the atomic receipt
  claim establishes ownership.
- Cancellation before selection causes zero reads/writes beyond signal
  inspection. Cancellation between items stops new claims. An in-flight item is
  awaited and its durable result is not rewritten or fabricated.
- A per-item exception is converted to a bounded failed/busy count and does not
  prevent later selected items from running. An observer exception cannot
  alter durable state or terminate the batch.
- The summary contains only bounded counts and outcome labels. Receipt UUIDs
  may be internal correlation fields but never metric labels.

## Receipt and object-lease contract

- Receipt claims use one exact conditional mutation over receipt UUID, TEST
  mode, current status/time eligibility, attempt count, and prior lease state.
  Exactly one mutation may win, increment attempts once, and persist the exact
  new token with a 60-second lease.
- An eligible receipt already at five attempts is conditionally moved to
  `DEAD_LETTER` without provider, agency, object-lease, or projection access.
- An active receipt lease cannot be stolen; an expired or orphaned processing
  lease is reclaimable. Wrong, expired, or replaced tokens cannot complete,
  fail, release, or overwrite work.
- Object-lease identity is exactly `(mode, accountScopeKey, objectType,
  objectId)`. Create races treat only that exact unique conflict as contention.
  An active lease cannot be stolen; expiration equality is reclaimable through
  an exact conditional token replacement.
- Ignored completion is one exact conditional write requiring an unexpired
  receipt token at a fresh write timestamp.
- Failure transition and any exact object-lease release occur in one
  transaction after revalidating receipt/object identities, tokens, and expiry
  against a fresh write timestamp.
- Retry delays remain exactly 30 seconds, 2 minutes, 10 minutes, and 1 hour,
  with five total attempts. Exhausted or non-retryable work is durably
  dead-lettered.
- Known serialization/deadlock conflicts may receive at most three bounded
  transaction attempts. Exhaustion fails closed; it does not fabricate a
  terminal outcome.

## Projection authority and atomicity

- `projectAndComplete` runs subscription projection, receipt `SUCCEEDED`
  transition, and exact object-lease release in one serializable transaction.
  A missing/mismatched row, token, lease, or affected-row count rolls back all
  three operations.
- The transaction re-reads at most two agencies by the exact Customer ID and
  requires exactly one. That row's ID and `customerId` must match the injected
  projection, closing the pre-transaction ownership-check gap.
- Existing Subscriptions are read by both authoritative `agencyId` and the
  schema's existing `subscritiptionId`. A provider subscription already bound
  to another agency, a conflicting agency row, or any uniqueness collision
  fails without reassignment.
- A create or update uses agency authority and persists exact `customerId`,
  `subscritiptionId`, `priceId`, `logicalPlan`, `active`, and period-end state.
  It never clears or rewrites legacy `plan` or `price` columns and does not
  rename the existing misspelled provider-subscription field.
- The transaction revalidates the receipt and object leases immediately before
  terminal persistence. A stale worker cannot project, release, or overwrite a
  reclaimed worker.
- Database failures injected before or after subscription persistence, receipt
  completion, or object-lease deletion must leave no partial projection or
  false terminal receipt.

## Provider and reconciliation boundary

- No concrete Stripe adapter is permitted. Production source may not import
  the Stripe SDK, `getStripeServerClient`, `fetch`, an HTTP client, a proxy, or
  credentials for provider reads.
- `WebhookProviderReader` remains injected. Test/disposable fixtures return
  current Subscription and Customer snapshots, not signed-event payload state.
- Tests assert the exact TEST mode, account scope, subscription ID, and Customer
  ID passed to the provider boundary.
- Eligible connected-account receipts are selected and claimed, then become
  durably `IGNORED` before provider retrieval, agency lookup, object-lease
  creation, or projection. A later A1 duplicate may return `200` only because
  that terminal state is durable.
- Unsupported events follow the same zero-provider ignored path.
- Reordered, reversed, duplicate, stale, and equal-provider-time lifecycle
  receipts converge to the injected current provider snapshot rather than
  trusting delivery or event order.
- Missing/deleted/foreign Customers, ambiguous ownership, mismatched metadata,
  wrong IDs, inactive/unknown/mode-mismatched Prices, or invalid Subscription
  state create zero projection writes and follow B4F1's bounded failure policy.
- Hostile provider exceptions become only existing bounded safe diagnostics;
  raw exceptions, objects, metadata, IDs, PII, or credentials are never emitted.

## Route and acknowledgement posture

- `src/app/api/stripe/webhook/route.ts`, B4F2A1 runtime configuration, and
  middleware remain byte-for-byte unchanged.
- New and nonterminal receipts continue to receive `503`. Only an already
  durable `SUCCEEDED`, `IGNORED`, or `DEAD_LETTER` duplicate receives `200`.
- A future acknowledgement change requires a separately proven continuously
  available worker, representative migration, availability evidence, and
  explicit route-response change control.

## Observability and data classification

- Reuse injected bounded observations; add no direct console, log, analytics,
  or external telemetry sink.
- Allowed fields are stage, bounded code/disposition/status labels, duration
  bucket, batch counts, and an optional receipt UUID correlation field.
- Provider IDs, Customer IDs, agency IDs, payloads, metadata, emails, raw
  errors, stack traces, secrets, SQL, and connection strings are forbidden.
- Receipt UUID is not a metric label. Outcome/code/status label values must come
  from finite allowlists.

## Expected implementation surfaces

- `src/lib/stripe/prisma-webhook-processing-store-core.ts`
- `src/lib/stripe/prisma-webhook-processing-store.ts`
- `src/lib/stripe/webhook-worker.ts`
- focused tests under `tests/stripe/`
- one generated/synthetic MySQL fixture if required
- `scripts/verify-webhook-processing-store.ts`
- `scripts/verify-webhook-processing-store.ps1`
- `docs/execution/CF-P1-B4F2A2-local-processor-worker-foundation.md`
- B4F2A2-specific dependency/evidence artifacts

This list is a boundary forecast, not permission to change every named file.

## Non-goals and forbidden surfaces

- No webhook route, runtime config, middleware, `PUBLIC_ROUTES`, A1 adapter,
  replay, or retention execution change.
- No scheduler, daemon, host integration, startup hook, internal/public HTTP
  trigger, deployment, CI, queue infrastructure, or availability claim.
- No Prisma schema, `prisma/migrations`, B4D/B4F SQL-draft modification,
  representative database, backup, restore, or persistent-data access.
- No package, lockfile, dependency, billing, commerce, Connect, Customer
  recovery, subscription-operation concurrency, design, Odoo, or CRM change.
- No Stripe SDK/client/provider adapter, credentials, CLI, endpoint registration,
  outbound network, provider mutation, credentialed Test rehearsal, Live Mode,
  or Stripe Tax.
- No closure or waiver of `CF-P1-AUDIT-FRESH-01`.

## Acceptance criteria

| ID | Pass/fail criterion | Required evidence |
| --- | --- | --- |
| CF-P1-B4F2A2-01 | Scope is limited to the Prisma processing store/due source/agency lookup and explicit run-once worker; every forbidden parent surface is unchanged. | Exact parent-range diff, import graph, and issue gate. |
| CF-P1-B4F2A2-02 | Discovery is TEST-only across all scopes, accepts only limits 1–25, and orders by ready time, creation time, then UUID without provider/event-time ordering. | Selection boundary/order/limit tests. |
| CF-P1-B4F2A2-03 | Discovery includes received, due retry, and expired/orphaned processing rows—including connected scope—and excludes terminal, future retry, active lease, and Live rows. | Before/equal/after clock matrix on real MySQL. |
| CF-P1-B4F2A2-04 | Receipt claim is atomic: one winner, one attempt increment, exact 60-second lease, safe reclaim, and provider-free attempt-ceiling dead letter. | Separate-client MySQL races and row assertions. |
| CF-P1-B4F2A2-05 | Object leases are exact and atomic; active leases resist theft, equality is reclaimable, and stale workers cannot act after reclaim. | Separate-client claim/reclaim races and stale-token matrix. |
| CF-P1-B4F2A2-06 | Ignored, retry, and dead-letter transitions require exact unexpired ownership; object release is exact and atomic with failure. | Wrong/expired/replaced-token and transaction-failure tests. |
| CF-P1-B4F2A2-07 | Persisted retry timing is exactly 30s/2m/10m/1h with five attempts and no provider work after terminal/exhausted state. | Fixed-clock persisted-state matrix. |
| CF-P1-B4F2A2-08 | Projection, `SUCCEEDED`, and object-lease release are one rollback-safe serializable transaction. | Database fault injection at each boundary and row checks. |
| CF-P1-B4F2A2-09 | Projection transaction revalidates exactly one agency/customer binding and prevents provider-subscription or agency reassignment/collisions while preserving legacy fields. | TOCTOU, duplicate-customer, foreign-subscription, uniqueness, and field-preservation tests. |
| CF-P1-B4F2A2-10 | Provider state is fixture-injected with exact arguments and zero Stripe client, credential, proxy, HTTP, fetch, or non-loopback transport dependency. | Network-denial trap, import scan, and provider spies. |
| CF-P1-B4F2A2-11 | Invalid/foreign/ambiguous current state produces zero projection and only bounded failure state. | Negative reconciliation matrix against real storage. |
| CF-P1-B4F2A2-12 | Reordered and concurrent receipts converge to fixture-current state with at most one simultaneous effective projection; losers safely retry and later converge. | Barrier-controlled multi-client MySQL races. |
| CF-P1-B4F2A2-13 | `runOnce` is finite/sequential and handles abort-before, abort-between, in-flight completion, empty batch, poison item, repeated run, observer failure, shutdown, and open handles safely. | Worker lifecycle and handle-leak tests. |
| CF-P1-B4F2A2-14 | Terminal outcomes are reported only after durable state; existing A1 response semantics and route remain unchanged. | Persisted result matrix and A1 regression tests. |
| CF-P1-B4F2A2-15 | Observations and summaries are finite/bounded/redacted; observer failure cannot change state or stop the batch. | Hostile error/observer/log/cardinality/secret tests. |
| CF-P1-B4F2A2-16 | Disposable MySQL covers selection, claims, object leases, rollback, projection, reordering, concurrency, process-loss recovery, outage, legacy compatibility, and cleanup on success/failure. | Repeatable container proof with zero leftovers. |
| CF-P1-B4F2A2-17 | Frozen install, Prisma generate/validate, focused/full tests, lint, typecheck, build, diff/secret scans, evidence hashes, clean immutable SHA, and package/lock continuity pass. | Fresh candidate-bound command evidence; audit status remains explicit. |
| CF-P1-B4F2A2-18 | Rollback removes only unwired A2 code and retains A1/B4F1 behavior; exact reviews and seals preserve every readiness state as FAIL. | Rollback record and immutable review/lifecycle chain. |

## Disposable schema and rollback

Existing B4D logical-plan and B4F1 inbox SQL drafts may be applied only to
randomly named disposable MySQL 8.4 containers. They may not be modified or
promoted. Generated/synthetic fixtures contain no representative or user data.
Every proof path forcibly removes its container, including deliberately failed
runs.

No application route, scheduler, provider, schema, migration, package,
credential, or persistent data is changed. Rollback is therefore an unwired
code/documentation revert that retains accepted A1/B4F1 behavior and additive
draft evidence.

## Stop conditions

- Stop if exact token and expiry revalidation cannot be proven at every
  terminal write.
- Stop if projection and receipt completion cannot be one rollback-safe
  transaction or concurrent workers can increment attempts/project twice.
- Stop if a stale worker can project, fail, release, or overwrite reclaimed
  work.
- Stop if connected receipts remain stranded or can reach provider/agency work.
- Stop if implementation needs a Stripe client, network, route/response change,
  scheduler, migration/schema change, representative data, or deployment.
- Stop if legacy fields are cleared, foreign authority can be reassigned, or
  ambiguous Customer ownership can project.
- Stop if direct logging, uncontrolled errors, secrets, PII, or provider data
  leave the bounded observer.

## Readiness posture

B4F2A2 PASS means only local persistence and worker-domain proof. Local
application, shared development, staging, pilot, production, and public-runtime
readiness remain `FAIL`. Representative schema/migration/backup/restore, real
worker hosting, credentialed Test Mode, public endpoint security, retention,
Connect, Live Mode, Stripe Tax, and `CF-P1-AUDIT-FRESH-01` remain later gates.

## Status

`READY`

## Execution Gate

`BLOCKED` — obtain exact Architect and Verifier contract tokens for the
versioned issue, record them in a documentation-only child, and receive
Acceptance implementation clearance.

## Target environment

Local pure/injected code and generated disposable MySQL 8.4 only.

## Maximum remediation rounds

`2`

## Human input

None for intake. Any representative database, credential, external provider,
public/shared runtime, deployment, security-posture, Live Mode, tax, or
destructive action requires later explicit authorization.
