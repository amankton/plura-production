# CF-P1-B4F1 — Durable Stripe webhook inbox foundation

## Problem

B4E secured authenticated caller-to-Stripe authority, but Stripe lifecycle
delivery is not durable, replayable, or safe under duplicates and reordering.
The current webhook route performs inline projection after signature checking,
has no receipt identity, lease, retry state, dead-letter state, or replay audit,
and cannot be made public safely.

GitHub Issues are disabled for `amankton/plura-production`, so this versioned
work item is the checkpoint's issue gate.

## Goal

Build and prove a local-only, replay-safe webhook receipt and convergence
foundation without exposing the route, changing its runtime behavior, applying
a real migration, or contacting Stripe.

## Scope

- A pure, injected receipt/intake/processor domain with no direct route or
  database dependency.
- Signature verification before parsing or persistence, a streamed 256 KiB raw
  body cap, mode-specific webhook secrets, a 300-second signature tolerance,
  and a SHA-256 body fingerprint.
- Unique receipt identity `(mode, accountScopeKey, eventId)` where the platform
  account scope is explicit and connected-account scopes cannot collide.
- Exact states: `RECEIVED`, `PROCESSING`, `RETRY_PENDING`, `SUCCEEDED`,
  `IGNORED`, and `DEAD_LETTER`.
- Atomic claim tokens and expirations; claims may take a received receipt, a due
  retry, or an expired processing lease. Only the matching lease token may
  complete or reschedule work.
- A separately keyed per-subscription object lease prevents simultaneous
  receipts from racing projections. Atomic projection/completion revalidates
  both the receipt lease and object lease.
- A five-attempt ceiling with bounded retry delays of 30 seconds, 2 minutes,
  10 minutes, and 1 hour before terminal dead-lettering.
- Minimal normalized receipt data: provider IDs, supported event type, provider
  creation time, body hash, state, attempts, leases, retry time, bounded safe
  error code/message, timestamps, and a 30-day operational retention deadline.
  Raw bodies, headers, secrets, full Customer objects, and uncontrolled provider
  errors are never persisted or logged.
- Supported lifecycle events: `customer.subscription.created`,
  `customer.subscription.updated`, and `customer.subscription.deleted`.
- Convergence from a fresh provider Subscription and Customer retrieval rather
  than event arrival order or event timestamps. Projection requires exactly one
  agency for the Customer, matching `crewframeAgencyId` metadata, platform
  account scope, matching Test/Live mode, and an exact Crewframe catalog Price.
- Transactional projection-and-completion, retry classification, terminal
  dead-letter behavior, redacted metrics/log records, and an internal audited
  replay command that accepts only a stored receipt ID and defaults to dry-run.
- Additive Prisma target models plus reviewed MySQL DDL kept outside
  `prisma/migrations`, with disposable-MySQL compatibility proof against empty
  and synthetic legacy fixtures.

## Non-Goals

- No public webhook or middleware allowlist change.
- No runtime route, Prisma adapter, background runner, scheduler, or Stripe
  endpoint registration.
- No representative, staging, production, or Live Mode migration.
- No external Stripe request or account mutation.
- No Connect OAuth, connected-account repair, Customer outbox, active
  subscription concurrency invariant, permission migration, or logical-plan
  migration application.
- No deployment, dependency upgrade, lockfile change, Stripe Tax enablement, or
  production-readiness claim.

## State and response contract

- Missing/invalid signature returns `400`; an oversized body returns `413`;
  both produce zero receipt writes.
- Receipt storage failure returns `503`.
- `SUCCEEDED`, `IGNORED`, and durable `DEAD_LETTER` duplicates return `200`.
- `RECEIVED`, `PROCESSING`, and `RETRY_PENDING` return `503` while no proven
  internal retry runner exists, so Stripe remains responsible for redelivery.
- Processing success or an intentionally ignored unsupported event returns
  `200` only after its terminal state is durable.
- A retryable processing failure is durably scheduled and returns `500`.
- A non-retryable or exhausted failure is durably dead-lettered and returns
  `200`; replay remains an explicit audited operator action.

## Acceptance Criteria

| ID | Pass/fail criterion | Required evidence |
| --- | --- | --- |
| CF-P1-B4F1-01 | Receipt schema implements every exact field/state, unique `(mode, accountScopeKey, eventId)` identity, lease, retry, error, provider timestamp, and retention invariant. | Schema/DDL inspection and schema tests. |
| CF-P1-B4F1-02 | Missing, invalid, expired, wrong-mode, or oversized signed input creates zero receipts; body streaming cancels as soon as 256 KiB is exceeded. | Focused intake and stream-consumption tests. |
| CF-P1-B4F1-03 | Concurrent duplicate deliveries resolve to one receipt and at most one effective projection. | Concurrency tests using an atomic injected repository. |
| CF-P1-B4F1-04 | Receipt persistence fails closed with `503`; no `2xx` is returned for work that is neither terminal nor owned by a proven runner. | Failure-injection and response-matrix tests. |
| CF-P1-B4F1-05 | Receipt and per-object claims are atomic, increment attempts once, recover expired leases, reject active/wrong tokens, prevent simultaneous projection for one subscription, apply bounded retry delays, and dead-letter after five attempts. | State-machine/object-lease clock and race tests. |
| CF-P1-B4F1-06 | Replay accepts only a stored receipt ID, is internal-authorized, audited, rejects arbitrary payloads, and defaults to dry-run. | Replay input/policy/audit tests. |
| CF-P1-B4F1-07 | Unsupported valid events become `IGNORED`; the three supported subscription lifecycle events converge from current provider state. | Supported/unsupported event tests. |
| CF-P1-B4F1-08 | Reordered, equal-timestamp, stale, duplicate, inactive, and deleted lifecycle events converge to the current provider object state without event-order assumptions. | Provider-state convergence matrix. |
| CF-P1-B4F1-09 | Unknown/inactive/wrong-mode Prices, deleted Customers, non-platform scopes, ambiguous ownership, foreign metadata, or foreign Customers produce zero subscription projection writes. | Catalog/mode/tenant negative tests. |
| CF-P1-B4F1-10 | Projection and receipt completion are one atomic unit; injected failure rolls both back and schedules or preserves retryable work. | Transaction rollback tests. |
| CF-P1-B4F1-11 | Logs, metrics, stored errors, and receipts are bounded and redacted; no secret, raw header/body, full provider object, or uncontrolled error is emitted. | Log/storage hygiene tests and secret scan. |
| CF-P1-B4F1-12 | Additive SQL applies to disposable MySQL from both an empty schema and a synthetic legacy schema and leaves existing legacy data readable. | Captured container/DDL/fixture commands and row checks. |
| CF-P1-B4F1-13 | Old application compatibility is proven after additive DDL; rollback reverts code while retaining additive tables and data. No destructive down migration exists. | Compatibility inspection/test and rollback record. |
| CF-P1-B4F1-14 | The runtime webhook route, public route allowlist, package manifest, lockfile, dependency versions, and external state are unchanged. | Parent-range diff and surface tests. |
| CF-P1-B4F1-15 | Frozen install, Prisma generation/validation, lint, typecheck, full tests, production build, and `git diff --check` pass. | Fresh command output tied to an immutable SHA. |
| CF-P1-B4F1-16 | Dependency audit does not regress from the B4E baseline of 63 advisories; a hashed SBOM and disposition are recorded. | Fresh audit plus SHA-256 artifact evidence. |
| CF-P1-B4F1-17 | Architect approves the immutable implementation, Verifier independently passes every criterion, and the execution record preserves checkpoint `PASS` separately from production-readiness `FAIL`. | Exact review tokens and sealed execution record. |

## Dependencies and blockers

- Parent/sealed B4E SHA:
  `1e8c03ae30c2d842ca1e0bf4e854479dfa5695c6`.
- Architecture token: `GO_B4F1_FOUNDATION`.
- Verifier contract token: `PASS_CONTRACT`.
- Docker Engine 29.6.1 and Compose 5.3.0 are available for disposable local
  MySQL proof.
- Additive DDL is a non-applyable draft until an authorized representative
  database baseline, drift review, backup/restore rehearsal, and the B4D
  logical-plan expand/backfill have passed.

## Program position

After B4F1, progression remains: B4F2 Stripe development-runtime closure;
agency authority closure; Crewframe re-theme/white-label foundation; agency
control-plane completion; agency development acceptance and sponsor taste
review; then the validated CRM/Odoo introduction contract. No Odoo or legacy
CRM write cutover belongs to this objective.

## Status

`DONE`

## Completion evidence

- Final implementation: `67f02349399f00ac4deb7c3a2f36608a9e7e30ff`.
- Sealed execution record: `8636ac79681d7245a463c5d056b337226c50f1f4`.
- Agency Architect: `APPROVE_B4F1_CANDIDATE`.
- Independent Verifier: `PASS_B4F1_CANDIDATE`, `PASS_B4F1_SEAL`.
- The completed checkpoint remains a local, non-deployable foundation. It does
  not authorize a migration, public webhook, external Stripe operation,
  deployment, Live Mode, or Stripe Tax.

## Execution Gate

`ALLOWED`

## Target environment

Local and disposable development only.

## Maximum remediation rounds

`2`
