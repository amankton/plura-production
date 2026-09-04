# CF-P1-B4F2A1 — Disabled Test-mode webhook intake adapter

## Problem

B4F1 proved a safe webhook intake domain and target receipt schema, but the
runtime route still buffers an unbounded body, uses ambiguous legacy/Live-first
secret selection, processes inline through the legacy subscription synchronizer,
and logs provider identifiers. The safe foundation has no Prisma intake adapter
and is intentionally disconnected from runtime.

## Goal

Connect only B4F1's bounded signature-first intake to the existing route and a
narrow Prisma receipt repository. The capability must remain disabled by
default, TEST-only, Clerk-protected, non-public, external-call-free, and unable
to process or project an event.

## Owner and prerequisites

- Implementation owner: Codex primary agent.
- Architecture reviewer: Crewframe Agency Architect.
- Independent verifier: Crewframe Verifier.
- Acceptance authority: Crewframe Acceptance Orchestrator.
- Accepted parent: `17c55e1f6563f357ef41e070385d0e8854025280`.
- B4F1 implementation: `67f02349399f00ac4deb7c3a2f36608a9e7e30ff`.
- B4F1 execution seal: `8636ac79681d7245a463c5d056b337226c50f1f4`.
- Intake contract: `B4F2A1_INTAKE_CONTRACT`.
- Issue-gate commit: `583570766e0cd0da0be560ba5bd8f672f254bd6b`.
- Architect entry token: `GO_B4F2A1_DISABLED_TEST_INTAKE`.
- Verifier contract token: `PASS_B4F2A1_CONTRACT`.

## Scope

- Add a server-only resolver for
  `STRIPE_WEBHOOK_INTAKE_MODE=disabled|test`; absence defaults to disabled and
  every other value fails closed.
- Enabled intake requires `STRIPE_CATALOG_MODE=test` and one nonblank
  `STRIPE_WEBHOOK_SECRET_TEST`. It never reads or falls back to
  `STRIPE_WEBHOOK_SECRET` or a Live signing secret.
- Disabled mode returns before reading the request body, resolving a signing
  secret, constructing a Stripe SDK verifier, or accessing Prisma.
- Replace the existing route body with a thin Node-runtime adapter over B4F1's
  streamed 256 KiB reader, explicit TEST signature verifier, 300-second
  tolerance, event normalization, and receipt response matrix.
- Add a narrow server-only Prisma intake repository that implements only
  `insertOrGet`. It may create a normalized receipt or resolve the exact
  `(TEST, accountScopeKey, eventId)` unique conflict to the existing row.
- Concurrent matching deliveries resolve to exactly one row. The same identity
  with a different payload hash fails closed, and unrelated Prisma/database
  errors remain storage failures.
- New or nonterminal receipts return `503` while no proven runner exists. Only
  an already durable `SUCCEEDED`, `IGNORED`, or `DEAD_LETTER` receipt may return
  `200`.
- Keep the route outside the public allowlist and retain Clerk middleware
  protection.
- Prove the repository against disposable MySQL 8.4 using generated empty and
  synthetic schemas, including duplicate races, payload-hash collision, table
  absence, database outage, and unconditional cleanup.
- Add bounded tests, local proof tooling, execution evidence, and dependency
  evidence tied to an immutable candidate.

## Response contract

- `400`: missing, invalid, expired, malformed, or wrong-mode signature/event;
  or a verified identity whose stored payload hash differs.
- `413`: the streamed raw body exceeds 256 KiB and its reader is cancelled
  before the tail is consumed.
- `503`: intake is disabled or misconfigured; storage is unavailable; a receipt
  is newly stored; or a duplicate receipt is not durably terminal.
- `200`: only an exact duplicate already durably marked `SUCCEEDED`, `IGNORED`,
  or `DEAD_LETTER`.

## Security and data classification

- Mode is server-selected. URL, headers, body, query, cookies, and browser input
  cannot select mode, account scope, signing secret, or persistence target.
- Signature verification precedes parsing and persistence. Stripe webhook
  requests do not use browser Origin/CSRF checks.
- Storage remains limited to B4F1's normalized provider identifiers, event
  type/time, payload hash, bounded processing state, and operational
  timestamps. The existing 30-day deadline remains a non-production placeholder
  pending a later privacy-owner retention decision.
- Raw bodies, headers, signatures, secrets, full events/provider objects,
  customer metadata, emails, and uncontrolled exceptions are not stored or
  logged.
- Responses and optional observations contain only bounded generic codes,
  statuses, and receipt UUIDs.

## Expected implementation surfaces

- `src/app/api/stripe/webhook/route.ts`
- `src/lib/stripe/webhook-runtime-config.ts`
- `src/lib/stripe/prisma-webhook-intake-store.ts`
- `src/lib/stripe/webhook-route-handler.ts`
- `.env.example`
- focused route/config/store tests under `tests/stripe/`
- disposable MySQL proof script and synthetic fixtures
- `docs/execution/CF-P1-B4F2A1-disabled-test-webhook-intake.md`
- A1-specific audit/SBOM evidence

This list is a boundary forecast, not permission to change every named file.

## Non-goals and forbidden surfaces

- No processor, worker, runner, scheduler, replay operator, retention job,
  projection, current-provider reconciliation, or status transition.
- No modification or invocation of `subscription-sync.ts`.
- No Stripe API call, provider-state retrieval/mutation, Stripe CLI forwarding,
  credentialed Test Mode activity, or endpoint registration.
- No public allowlist, middleware protection, host-routing, or deployment
  change.
- No Prisma schema change, applyable migration, representative database access,
  backup, restore, or data mutation outside generated disposable MySQL.
- No package, lockfile, dependency, billing, commerce, Connect OAuth, Customer
  recovery, subscription-concurrency, Odoo, CRM, design, or historical
  checkpoint-record change.
- No Live Mode or Stripe Tax.

## Acceptance criteria

| ID | Pass/fail criterion | Required evidence |
| --- | --- | --- |
| CF-P1-B4F2A1-01 | Configuration defaults to disabled; malformed/unknown configuration fails closed. Disabled mode reads no body or secret, constructs no Stripe client, and accesses no Prisma store. | Configuration and zero-interaction route tests. |
| CF-P1-B4F2A1-02 | Only explicit server-selected TEST mode can reach intake and it requires exact Test catalog mode plus `STRIPE_WEBHOOK_SECRET_TEST`; caller input cannot select mode and no legacy/Live fallback exists. | Environment matrix and source-surface tests. |
| CF-P1-B4F2A1-03 | The route uses B4F1's 256 KiB streamed reader, 300-second Stripe SDK signature tolerance, and signature-before-persistence flow. | Exact-byte, expiry, overflow, cancellation, and zero-write tests. |
| CF-P1-B4F2A1-04 | Prisma intake implements only `insertOrGet`, treats only the exact composite unique conflict as duplication, and maps unrelated errors to storage failure. | Adapter contract and injected Prisma-error tests. |
| CF-P1-B4F2A1-05 | Concurrent exact duplicates produce one row and return the existing normalized receipt; an identity/hash conflict fails closed. | Real disposable-MySQL race and collision tests. |
| CF-P1-B4F2A1-06 | New/nonterminal receipts return `503`; only exact already-durable terminal duplicates return `200`. | Full response-state matrix. |
| CF-P1-B4F2A1-07 | The adapter never imports or invokes the processor, replay, subscription synchronizer, provider retrieval/mutation, direct logging, or unbounded `req.text()`. | Import/call surface tests and provider spies. |
| CF-P1-B4F2A1-08 | Responses, storage, and observations are bounded/redacted and contain no raw body/header/signature, secret, provider object, PII, or uncontrolled exception. | Hygiene tests and secret/log scan. |
| CF-P1-B4F2A1-09 | The webhook remains absent from `PUBLIC_ROUTES`; neighboring paths/methods remain protected and no external delivery is possible. | Middleware/routing tests and parent-range diff. |
| CF-P1-B4F2A1-10 | Disposable MySQL 8.4 empty/synthetic proofs cover race, collision, missing table, outage, legacy readability, and cleanup after success/failure. | Captured repeatable proof command and zero-container check. |
| CF-P1-B4F2A1-11 | Prisma schema/migrations, package/lockfile, dependencies, billing, commerce, Connect, worker/processor/replay/retention, design, and prior sealed records are unchanged. | Exact parent-range forbidden-surface diff. |
| CF-P1-B4F2A1-12 | Frozen install, Prisma generation/validation, focused and full tests, lint, typecheck, production build, diff check, secret scan, SBOM, and dependency-audit non-regression pass at an immutable SHA. | Fresh independent command evidence and artifact hashes. |
| CF-P1-B4F2A1-13 | Architect approves the immutable implementation, Verifier independently passes every criterion, and the execution record preserves checkpoint PASS separately from development/staging/pilot/production readiness FAIL. | Exact tokens and sealed execution/lifecycle records. |

## Migration impact and rollback

- No schema or representative data change is permitted. The existing B4F1 DDL
  may be applied only to randomly named disposable MySQL containers.
- `STRIPE_WEBHOOK_INTAKE_MODE=disabled` is the runtime kill switch and default.
- If enabled without the target tables or with unavailable storage, the route
  must return `503` and never acknowledge the event.
- Code rollback restores accepted B4F1 behavior. Disposable containers must be
  uniquely named and forcibly removed in a `finally` path even after failure.

## Stop conditions

- Stop on any required forbidden-surface change or external access.
- Stop if any unverified/new/nonterminal receipt can receive `2xx`.
- Stop if duplicate races cannot be proven to create exactly one real MySQL
  row, or if cleanup leaves a container behind.
- Stop if enabled intake can fall back to legacy/Live configuration.
- Stop if the route can invoke processing, synchronization, replay, or an
  outbound Stripe method.

## Evidence-policy change control

`AMEND_B4F2A1_AUDIT_EVIDENCE_STALE_UNREVALIDATED`

This amendment applies only to immutable candidate
`73336f38bb9877f2f1210316a721fa958ceb41e9` and only permits this
non-deployable B4F2A1 checkpoint to substitute dependency-graph continuity and
explicitly stale audit provenance for the fresh registry result required by
CF-P1-B4F2A1-12 and V-A1-14. It does not alter the original criterion, accept a
dependency vulnerability, or represent the historical result as current.

Accepted substitution evidence:

- `package.json` and `bun.lockb` have no parent-range diff.
- Lockfile SHA-256:
  `87503b664f64f829f664971fb17ff90407d00ab3cd4f2d4107324cad8616db43`.
- Candidate SBOM normalized-LF SHA-256:
  `6eea2a58cf6d0d63e47a45d83ae303c4d9cfa3a322106be754f232b155f7903b`.
- Sealed B4F1 audit normalized-LF SHA-256:
  `e1b3bcbc076cebf4580201ed833f95366a6ead6e05496f72a215d0b7c548df6b`.
- Audit-outage transcript normalized-LF SHA-256:
  `43db8bae8271734c48af9fcd9dd72ec7f1e343f018383a825293e02e6471f5fc`.
- The transcript records timestamped 15-second attempts through native Bun
  1.3.11, digest-pinned official Bun 1.3.11, and a direct npm bulk-advisory
  POST. Each returned zero advisory JSON.
- One bounded native retry after candidate freeze and one after substantive
  review also returned no advisory JSON and only the Bun 1.3.11 banner.
- Candidate worktree was clean and the disposable-container count was zero.

The sealed B4F1 result—63 advisories at that historical query—is classified
only as `STALE_UNREVALIDATED`. The current advisory count and severity are
unknown.

`CF-P1-AUDIT-FRESH-01` is a hard follow-up gate. A fresh authoritative
dependency audit and explicit disposition must pass before public webhook or
endpoint registration; shared-development, staging, pilot, or production
deployment; a public-runtime or release-readiness claim; or closure of the
dependency-security checkpoint. Local B4F2A2 foundation work may proceed only
under its own gate while this risk remains unresolved.

This is one evidence-policy change-control event and consumes no implementation
remediation round. It authorizes no public route, provider, database,
deployment, Live Mode, Stripe Tax, dependency, billing, or source change.

## Status

`READY`

## Execution Gate

`ALLOWED` — exact Architect and Verifier entry tokens recorded. Implementation
still requires `GO_B4F2A1_IMPLEMENTATION` from the Acceptance Orchestrator.

## Target environment

Local application process and generated disposable MySQL 8.4 only.

## Maximum remediation rounds

`2`

## Human input

None for A1. Representative database access, external credentials/calls,
webhook exposure/registration, shared-environment deployment, Live Mode, tax,
or destructive actions require later explicit authorization.
