# CF-P1-B4F1 — Durable Stripe webhook inbox foundation

## Checkpoint

- Sealed B4E parent: `1e8c03ae30c2d842ca1e0bf4e854479dfa5695c6`
- Versioned issue gate: `e8813fd577ae98274fa6d3fa13c21d1af425e5c9`
- Branch: `codex/crewframe-foundation`
- Acceptance clearance: `GO_B4F1_FOUNDATION`
- Architect decision: `GO_B4F1_FOUNDATION`
- Verifier contract/gate: `PASS_CONTRACT`, `PASS_GATE`
- Implementation SHA: pending immutable candidate
- Independent implementation verification: pending immutable candidate
- Production readiness: **FAIL** (intentional)

## Outcome

B4F1 establishes a non-deployable Stripe webhook receipt, lease, retry,
dead-letter, replay-audit, and current-provider-state convergence foundation.
It adds target Prisma models and an additive MySQL DDL draft, but deliberately
does not connect the foundation to the current route, a real database, a
background runner, or Stripe.

The runtime webhook remains Clerk-protected. The public route allowlist remains
exactly `['/site', '/api/uploadthing']`.

## Implemented contract

- The signed raw body is capped incrementally at 256 KiB and the reader is
  cancelled immediately on overflow, including with missing or dishonest
  Content-Length.
- Missing, invalid, expired, wrong-mode, malformed, or oversized input reaches
  zero receipt writes. Test and Live endpoint secrets are selected explicitly;
  no Live-first fallback exists. The signature tolerance is 300 seconds.
- Receipt identity is unique by `(mode, accountScopeKey, eventId)`. Account
  scope comes only from the verified Stripe event and distinguishes platform
  from an exact connected account.
- Only provider IDs, event type/time, a SHA-256 body fingerprint, processing
  state, leases, bounded safe diagnostics, and retention timestamps are modeled.
  Raw bodies, raw headers, signing secrets, full provider objects, emails, and
  uncontrolled provider errors are not stored or logged.
- States are `RECEIVED`, `PROCESSING`, `RETRY_PENDING`, `SUCCEEDED`, `IGNORED`,
  and `DEAD_LETTER`. Claims use exact tokens and 60-second expirations. Retry
  delays are bounded at 30 seconds, 2 minutes, 10 minutes, and 1 hour, with a
  five-attempt ceiling.
- A separately keyed subscription object lease prevents simultaneous receipts
  from racing projections. Projection and receipt completion revalidate both
  tokens as one injected atomic operation.
- Duplicate terminal receipts are safe to acknowledge. Pending, processing, or
  retryable work remains non-2xx while no proven internal retry runner exists.
- Only subscription created, updated, and deleted lifecycle events enter
  reconciliation. Connected-account and unsupported events terminate as
  ignored without provider reads.
- Reconciliation retrieves the current Subscription and Customer instead of
  trusting delivery order, event time, or the event object's business state.
  It requires platform scope, matching mode, an exact active Crewframe Price,
  exactly one local agency for the Customer, and matching
  `crewframeAgencyId` metadata before projection.
- Only Stripe status `active` grants entitlement. Canceled/deleted lifecycle
  delivery converges to the currently retrieved inactive state.
- Replay is an injected internal command over one stored receipt UUID, rejects
  unknown fields/arbitrary payloads, requires authorization, always audits the
  decision, and defaults to dry-run.
- Observability is an optional bounded structured callback containing only
  checkpoint codes, receipt UUID, state, stage, and response status. The pure
  foundation performs no direct logging.

## Schema and migration posture

The Prisma target adds `StripeWebhookReceipt`, `StripeWebhookObjectLease`, and
`StripeWebhookReplayAudit`. The reviewed SQL is stored at
`docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql` and contains only
additive `CREATE TABLE IF NOT EXISTS` statements.

The SQL is intentionally outside `prisma/migrations`. It is compatibility
evidence only and is not approved or ready for a representative, development,
staging, or production database. The first disposable run found an index name
that exceeded MySQL's 64-character limit; the draft was corrected to use the
short names declared in Prisma before the passing empty and legacy runs.

## Verification

- `bun install --frozen-lockfile`: required for immutable-candidate verification.
- `bunx prisma generate`: pass.
- `bunx prisma validate` with a process-local placeholder URL: pass.
- `bun run lint`: pass; no warnings or errors.
- `bun run typecheck`: pass.
- Focused B4F1 tests: 35 passed, 0 failed.
- Complete `bun test`: 237 passed, 0 failed, 1,018 expectations across 32 files.
- `bun run build`: pass; compilation and 13/13 static-page generation completed.
- Disposable MySQL 8.4 empty schema: pass.
- Disposable MySQL 8.4 synthetic legacy schema: pass; the existing agency and
  subscription row remained readable after the additive DDL.
- Package manifest, lockfile, runtime webhook route, middleware public allowlist,
  and `prisma/migrations`: unchanged from the issue-gate parent.
- `git diff --check`: required for immutable-candidate verification.
- Secret-pattern scan: required for immutable-candidate verification.

## Dependency evidence

- Installed-component inventory:
  `docs/evidence/CF-P1-B4F1-sbom.txt`
- Inventory normalized-LF SHA-256:
  `6eea2a58cf6d0d63e47a45d83ae303c4d9cfa3a322106be754f232b155f7903b`
- Audit evidence:
  `docs/evidence/CF-P1-B4F1-audit.json`
- Audit normalized-LF SHA-256:
  `e1b3bcbc076cebf4580201ed833f95366a6ead6e05496f72a215d0b7c548df6b`
- Lockfile SHA-256:
  `87503b664f64f829f664971fb17ff90407d00ab3cd4f2d4107324cad8616db43`
- Audit: 63 inherited advisories (0 critical, 34 high, 25 moderate, 4 low),
  exactly equal to the B4E baseline.

The advisories remain a release blocker assigned to the dependency-upgrade
checkpoint. B4F1 introduces no package or lockfile change and does not claim
that the inherited advisories are safe or resolved.

## Rollback

B4F1 has no route, provider, real database, migration, data, credential, or
deployment mutation. Rollback is a code/documentation revert. The two local
MySQL containers are randomly named, contain only generated/synthetic data,
and are forcibly removed by the proof script.

For a later runtime rollback, disable the webhook endpoint and worker first,
retain additive receipt/lease/audit tables for evidence and replay, and repair
schema forward. No destructive down migration is proposed.

## Remaining blockers

1. Obtain database-owner authorization and a representative schema baseline,
   version/collation inventory, drift report, backup, and successful restore.
2. Apply and verify the B4D logical-plan expansion/backfill before the webhook
   inbox migration.
3. Review and apply the B4F additive schema, then implement the real Prisma
   repository, worker, metrics, retention job, and operator tooling.
4. Perform a credentialed Stripe Test Mode webhook rehearsal covering signature
   failure, duplicates, retries, reordering, inactivity, deletion, and replay.
5. Obtain explicit security-posture approval before making the webhook public
   or registering an endpoint. Live Mode remains untouched.
6. Complete Customer outbox/orphan recovery, the one-active-subscription
   invariant, signed single-use Connect OAuth, connected-account ownership
   reconciliation, CSP, permission migration, and dependency remediation in
   their separate checkpoints.
7. Obtain a privacy decision on production receipt/dead-letter/audit retention.
8. Stripe Tax remains disabled pending registrations, jurisdiction and product
   configuration, customer-location handling, and qualified tax review.
