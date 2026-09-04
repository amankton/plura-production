# CF-P1-B4F2A1 — Disabled Test-mode webhook intake adapter

## Checkpoint

- Accepted parent: `17c55e1f6563f357ef41e070385d0e8854025280`
- Versioned issue gate: `e62bbea885ef3852e6722111a0550b866d609c3a`
- Branch: `codex/crewframe-foundation`
- Intake contract: `B4F2A1_INTAKE_CONTRACT`
- Architect entry token: `GO_B4F2A1_DISABLED_TEST_INTAKE`
- Verifier contract token: `PASS_B4F2A1_CONTRACT`
- Acceptance implementation clearance: `GO_B4F2A1_IMPLEMENTATION`
- Provisional freeze clearance: `GO_B4F2A1_CANDIDATE_FREEZE_AUDIT_PENDING`
- Implementation SHA: `73336f38bb9877f2f1210316a721fa958ceb41e9`
- Architect implementation approval: `APPROVE_B4F2A1_CANDIDATE`
- Audit amendment commit: `c3186d3967995d5259e9b27c9aabceb695f063d4`
- Acceptance audit amendment:
  `AMEND_B4F2A1_AUDIT_EVIDENCE_STALE_UNREVALIDATED`
- Architect audit-amendment approval: `APPROVE_B4F2A1_AUDIT_AMENDMENT`
- Verifier audit-amendment approval: `PASS_B4F2A1_AUDIT_AMENDMENT`
- Independent implementation verification:
  `PASS_B4F2A1_CANDIDATE_WITH_AUDIT_AMENDMENT`
- Remediation rounds used: 0 of 2
- Evidence-policy change-control events: 1
- Dependency-audit classification: **STALE_UNREVALIDATED**
- Current dependency-advisory state: **UNKNOWN**
- Development readiness: **FAIL**
- Staging readiness: **FAIL**
- Pilot readiness: **FAIL**
- Production readiness: **FAIL** (intentional)
- Public-runtime readiness: **FAIL**

## Outcome

B4F2A1 replaces the legacy inline Stripe webhook path with a thin adapter over
the B4F1 bounded, signature-first intake domain and a narrow Prisma
`insertOrGet` repository. The capability is disabled by default, TEST-only,
Clerk-protected, non-public, and unable to process or project an event.

This checkpoint does not register an endpoint, contact Stripe, apply a
migration, access a representative database, deploy, or enable the route. New
and nonterminal receipts deliberately receive `503` because there is no proven
local runner yet.

## Runtime contract

- `STRIPE_WEBHOOK_INTAKE_MODE` accepts only exact `disabled` or `test`; absence
  defaults to disabled and every malformed value fails closed.
- Enabled intake also requires exact `STRIPE_CATALOG_MODE=test` and a nonblank
  `STRIPE_WEBHOOK_SECRET_TEST`. Runtime source never reads the legacy or Live
  webhook secrets.
- Disabled or invalid configuration returns `503` before request headers/body,
  the Stripe SDK verifier, or Prisma are accessed.
- The Node route dynamically composes the existing server Stripe client and
  the server-only Prisma adapter only after configuration authorizes TEST
  intake. Caller URL, headers, query, cookies, and body cannot select mode or
  credentials.
- B4F1 performs the incremental 256 KiB read, cancellation on overflow,
  300-second signature verification, verified event normalization, and
  signature-before-persistence ordering.
- A new or nonterminal receipt returns `503`. Only an exact already-durable
  `SUCCEEDED`, `IGNORED`, or `DEAD_LETTER` duplicate returns `200`.
- Invalid input and identity/hash conflicts return `400`; overflow returns
  `413`; configuration and storage failures return `503`.
- Responses contain only bounded generic `code` and `received` fields. The
  adapter contains no direct logging, processing, replay, provider fetch, or
  subscription synchronization.

## Persistence contract

The server-only Prisma composition exposes only the B4F1 `insertOrGet`
interface. It inserts a normalized receipt, or handles only Prisma `P2002` for
the exact named `stripe_webhook_identity` constraint or its exact three-field
set `(mode, accountScopeKey, eventId)`. Neighboring, partial, reordered,
non-array, or unrelated errors are rethrown as storage failures.

An exact conflict is followed by one exact `findUnique`. If no row exists, the
original conflict is rethrown. B4F1 compares the persisted payload hash and
fails closed when the same verified identity carries different bytes.

No Prisma schema or migration changed. The existing B4F1 additive DDL is used
only inside generated disposable MySQL 8.4 containers.

## Verification

- `bun install --frozen-lockfile`: pass; 895 installs across 705 packages with
  no changes.
- `bunx prisma generate`: pass.
- `bunx prisma validate` with a process-local placeholder URL: pass.
- `bun run lint`: pass; no warnings or errors.
- `bun run typecheck`: pass.
- Focused B4F/B4F2A1 tests: 45 passed, 0 failed, 257 expectations.
- Complete `bun test`: 262 passed, 0 failed, 1,153 expectations across 36 files.
- Independent A1-specific tests: 19 passed, 0 failed, 89 expectations.
- Independent combined webhook tests: 60 passed, 0 failed, 351 expectations.
- `bun run build`: pass; compilation and 13/13 static-page generation completed.
- Disposable MySQL 8.4 missing-table path: pass; intake failed closed.
- Disposable MySQL 8.4 concurrent race: pass; 20 real Prisma calls converged
  to one row and exactly one inserted result.
- Disposable MySQL 8.4 identity/hash collision: pass; the conflict was rejected
  and the original hash remained unchanged.
- Disposable MySQL 8.4 synthetic legacy schema: pass; the legacy row remained
  readable and intake inserted successfully.
- Database-outage path: pass; intake failed closed.
- Cleanup after both successful and deliberately failed proof paths: pass; zero
  `crewframe-b4f2a1-*` containers remained.
- Forbidden runtime import/call scan: pass; zero processor, synchronizer,
  provider-call, direct-log, legacy/Live-secret, or unbounded-body matches.
- Package manifest, lockfile, Prisma schema/migrations, middleware/public
  allowlist, subscription synchronizer, and prior sealed records: unchanged
  from the issue-gate parent.
- `git diff --check`: pass.
- Dependency evidence was accepted for this non-deployable checkpoint only
  under amendment `c3186d3967995d5259e9b27c9aabceb695f063d4`. It remains
  explicitly `STALE_UNREVALIDATED`; current vulnerability intelligence is
  unknown and hard gate `CF-P1-AUDIT-FRESH-01` remains open.

The first local disposable collision rehearsal used a synthetic event ID that
did not satisfy B4F1's provider-ID grammar. The proof failed and its `finally`
path left zero containers. The fixture was corrected without relaxing the
runtime validator; the complete proof then passed.

## Dependency evidence

- Installed-component inventory:
  `docs/evidence/CF-P1-B4F2A1-sbom.txt`
- Fresh inventory normalized-LF SHA-256:
  `6eea2a58cf6d0d63e47a45d83ae303c4d9cfa3a322106be754f232b155f7903b`
- Bounded audit-service outage transcript:
  `docs/evidence/CF-P1-B4F2A1-audit-outage.json`
- Outage transcript normalized-LF SHA-256:
  `43db8bae8271734c48af9fcd9dd72ec7f1e343f018383a825293e02e6471f5fc`
- Dependency evidence summary:
  `docs/evidence/CF-P1-B4F2A1-dependency-evidence.json`
- Current lockfile SHA-256:
  `87503b664f64f829f664971fb17ff90407d00ab3cd4f2d4107324cad8616db43`
- Sealed B4F1 audit provenance:
  `docs/evidence/CF-P1-B4F1-audit.json`, normalized-LF SHA-256
  `e1b3bcbc076cebf4580201ed833f95366a6ead6e05496f72a215d0b7c548df6b`
- Sealed audit source commit and timestamp:
  `0da47545c1a8d2ec833f89c36030b9e182349fc8`,
  `2026-09-03T17:46:44-07:00`
- Stale sealed result: 63 advisories (0 critical, 34 high, 25 moderate,
  4 low). This is not a fresh vulnerability-database result.

Native Bun 1.3.11, the digest-recorded official Bun 1.3.11 container, and a direct
npm bulk-advisory POST each received zero advisory JSON within a bounded
15-second attempt. One bounded retry after candidate freeze and one after
substantive review also returned no advisory JSON. The inherited advisories and
missing current query remain a release/public-runtime blocker. B4F2A1
introduces no package or lockfile change and does not claim that the stale
findings are current, safe, or resolved.

The exact implementation candidate passed Agency Architect review with
`APPROVE_B4F2A1_CANDIDATE`. The independent Verifier reproduced the complete
build, routing, hygiene, and disposable MySQL evidence and first returned
`PASS_B4F2A1_IMPLEMENTATION_AUDIT_HELD`. After the Acceptance Orchestrator,
Architect, and Verifier approved the exact documentation-only audit amendment,
the Verifier returned `PASS_B4F2A1_CANDIDATE_WITH_AUDIT_AMENDMENT`. No source
remediation was required.

## Rollback

`STRIPE_WEBHOOK_INTAKE_MODE=disabled` is both the default and runtime kill
switch. Code rollback restores the accepted B4F1 route implementation. No
schema, migration, representative data, provider, deployment, endpoint, or
credential mutation needs reversal. The proof script assigns random container
names, database credentials, and host ports and forcibly removes its containers
on both success and failure.

## Remaining blockers

1. Verify this documentation-only execution seal, then complete a separately
   verified lifecycle seal before advancing.
2. Implement and prove B4F2A2's local processor/runner before any newly stored
   receipt may receive `2xx`.
3. Obtain database-owner authorization and representative schema, drift,
   backup, restore, and migration evidence before applying B4F DDL anywhere
   persistent.
4. Complete a separate credentialed Stripe Test Mode rehearsal before endpoint
   registration or exposure.
5. Obtain explicit security-posture approval before making the route public or
   changing host routing. Live Mode remains untouched.
6. Complete Customer recovery, subscription concurrency, Connect OAuth, CSP,
   permission migration, dependency remediation, and later CRM gates.
7. Obtain a privacy-owner decision for production receipt and audit retention.
8. Pass `CF-P1-AUDIT-FRESH-01` before any public endpoint, shared environment,
   deployment, release-readiness claim, or dependency-security closure.
9. Stripe Tax remains disabled pending business registrations, jurisdiction and
   product configuration, location handling, and qualified tax review.
