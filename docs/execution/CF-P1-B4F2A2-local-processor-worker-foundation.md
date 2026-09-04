# CF-P1-B4F2A2 — Local TEST processor/worker foundation

## Checkpoint

- Accepted parent and B4F2A1 lifecycle seal:
  `8bd7805658d16a0a7587bf6a370423dd2ee3a795`.
- Issue-gate commit: `a441fd3e46dd35d303361845ca4b26a75a363d77`.
- Approval-record commit: `d44e07d86fc00304957a318e206afbc2d254ffb5`.
- Final implementation gate:
  `8c15412ed3be67d4846c0673a402eec8916e27ab`.
- Branch: `codex/crewframe-foundation`.
- Architect entry token:
  `GO_B4F2A2_LOCAL_PROCESSOR_WORKER_FOUNDATION`.
- Verifier contract token: `PASS_B4F2A2_CONTRACT`.
- Acceptance implementation clearance: `GO_B4F2A2_IMPLEMENTATION`.
- Confirmation token: `GO_B4F2A2_IMPLEMENTATION_CONFIRMED`.
- Audit evidence amendment:
  `AMEND_B4F2A2_AUDIT_EVIDENCE_STALE_UNREVALIDATED`.
- Implementation SHA: **pending immutable candidate**.
- Independent implementation verification: **pending**.
- Implementation remediation rounds used: 0 of 2.
- Evidence-policy change-control events: 1.
- Dependency-audit classification: **STALE_UNREVALIDATED**.
- Current dependency-advisory state: **UNKNOWN**.
- Local application readiness: **FAIL**.
- Shared development readiness: **FAIL**.
- Staging readiness: **FAIL**.
- Pilot readiness: **FAIL**.
- Production readiness: **FAIL**.
- Public-runtime readiness: **FAIL**.

## Outcome

B4F2A2 adds an unwired, server-only Prisma composition for the accepted B4F1
processing domain and a pure, explicit `runOnce` worker. The implementation can
select no more than 25 eligible TEST receipts, process them sequentially,
serialize work per subscription, project one authoritative agency
subscription, and persist ignored, retry, success, or dead-letter outcomes.

This checkpoint does not add a Stripe provider adapter, timer, queue, daemon,
package script, startup hook, route, public/internal trigger, migration,
deployment, credential, or persistent-data operation. The private intake route
continues returning `503` for new or nonterminal receipts. No environment can
run this capability without a future, separately authorized composition.

## Persistence and authority contract

- Due selection is structurally `mode = TEST`, spans platform and connected
  account scopes, accepts only limits 1 through 25, and orders by effective
  ready time, receipt creation time, then UUID.
- Receipt claims and object-lease claims use serializable transactions, exact
  compare-and-set predicates, 60-second leases, and at most three retries for
  known Prisma serialization/deadlock conflicts.
- Receipt, object lease, projection, account scope, mode, subscription, and
  compatible Customer identities are cross-bound inside the transaction. A
  connected receipt cannot project, and an unrelated object lease cannot be
  released by a receipt failure.
- Failure plus an owned object-lease release is one transaction. Projection,
  receipt `SUCCEEDED`, and object-lease release are one transaction. Wrong,
  expired, or replaced ownership returns no fabricated terminal result.
- Projection re-reads at most two agencies for the exact Customer ID and
  requires one exact agency/Customer binding. An existing provider
  subscription owned by another agency and an agency subscription bound to a
  different provider subscription both fail closed.
- Existing subscription updates condition on stable row ID, agency ID, and
  prior provider-subscription binding and require exactly one affected row.
  Current state updates never touch the legacy `plan` or `price` fields.
- Connected-account and unsupported receipts become durably `IGNORED` before
  provider, agency, object-lease, or projection work.

## Worker contract

- `runStripeWebhookWorkerOnce` requires an explicit integer limit of 1 through
  25 and has no ambient source, provider, persistence, clock, or token
  authority.
- Cancellation before selection performs no work. Cancellation between items
  starts no new claim, and an in-flight item is awaited.
- Items run sequentially. One poison item, provider/store failure, or observer
  exception cannot fabricate durable success or stop later selected work.
- Returned data is a frozen finite-count summary with no provider, Customer,
  agency, payload, metadata, error, connection, or credential values.
- Empty and repeated runs terminate normally. No timer, polling loop, detached
  promise, scheduler, or force-exit mechanism is used.

## Disposable MySQL proof

The repeatable proof creates randomly named MySQL 8.4 containers with random
ephemeral credentials and host ports. It applies only a generated synthetic
Agency/Subscription compatibility fixture and the unchanged B4F1 additive DDL.
The `finally` paths remove exact generated container names on successful,
outage, and deliberately failed cleanup paths.

The real Prisma proof covers:

- missing-table and unavailable-database fail-closed paths;
- all eligible and excluded selection states, expiry equality, equal ready and
  creation-time UUID ordering, connected scope, and the 25-row limit;
- twelve-client receipt and object-lease races, active-lease theft resistance,
  exact attempt increments, expiry reclaim, and attempt-ceiling dead letter;
- wrong, expired, replaced, unrelated, and cross-scope lease/authority cases;
- exact retry delays and the five-attempt ceiling;
- success and injected database failures before subscription persistence,
  receipt completion/failure, and object-lease deletion, with rollback checks;
- legacy-field preservation, duplicate Customer ownership, foreign provider
  subscription ownership, conflicting agency subscription binding, and
  unrelated Customer/object rejection;
- missing/deleted/foreign Customers, missing/ambiguous agencies, metadata and
  identity mismatches, inactive/unknown/mode-mismatched Prices, malformed
  subscription state, and hostile provider errors;
- mixed and repeated worker runs, two processors contending for the same
  receipt, distinct receipts contending for one subscription, reversed
  lifecycle delivery, equal provider time, stale-worker replacement, recovery,
  and eventual convergence to fixture-current provider state; and
- zero leftover `crewframe-b4f2a2-*` containers after every proof path.

No representative schema or data is read, modified, inferred, or claimed.

## Verification

- `bun install --frozen-lockfile`: pass; 895 installs across 705 packages with
  no changes.
- `bunx prisma generate`: pass.
- `bunx prisma validate` with a process-local placeholder URL: pass.
- `bun run lint`: pass; no warnings or errors.
- `bun run typecheck`: pass.
- Focused A2 tests: 15 passed, 0 failed, 69 expectations.
- Complete `bun test`: 277 passed, 0 failed, 1,222 expectations across 39
  files.
- `bun run build`: pass; compilation and 13/13 static-page generation
  completed.
- Disposable MySQL 8.4 proof: pass for selection, races, lease isolation,
  retries, rollback, projection, negative reconciliation, worker concurrency,
  reordering, process-loss recovery, outage, legacy compatibility, and cleanup.
- `git diff --check`: pass.
- A2 production-source import/call scan: no Stripe client, server client,
  `fetch`, HTTP URL/client, proxy, scheduler, timer, direct log, route, replay,
  or provider transport.
- Provider arguments are spy-checked; disposable processing uses only injected
  in-process fixture readers and loopback MySQL transport.
- B4F1/A1 response and route regression tests pass; new/nonterminal intake
  remains `503`, and only already-durable terminal duplicates return `200`.
- Focused tests and proof processes exit normally without force-exit; the source
  scan finds no worker timer/polling primitive and Docker cleanup finds no open
  disposable runtime.
- Package manifest, lockfile, Prisma schema/migrations, private webhook route,
  route handler, runtime configuration, middleware/public allowlist, and B4F1
  DDL are byte-for-byte unchanged from the final implementation gate.

Protected-surface Git blob continuity from
`8c15412ed3be67d4846c0673a402eec8916e27ab`:

| Surface | Git blob |
| --- | --- |
| `package.json` | `c8a1a9d11f484792d9d2ffee9d5c728144841105` |
| `bun.lockb` | `9fd7455e517b55bd2cc77a882cc4468f0eebb526` |
| `prisma/schema.prisma` | `68cc70de4c0e3d3d18fa29c00869d256c3230700` |
| private webhook route | `bec844221982137ccc085b804d5906e36283eca5` |
| A1 route handler | `c4046bd3d583c18c1b8b042d8bd9ea69d06570e2` |
| runtime configuration contract | `adb07809e07e4bedd4a2e603df06d9c1c734e257` |
| server-only runtime composition | `2092c9cc900d4ec611cf3a7e90f41b7686d1aaa0` |
| middleware/public allowlist | `852f9b7633059499468ee3fdbcc66d8869490f8c` |
| B4F1 additive DDL | `6b20010ab8b9a1c1072ab79b16b8f5cd87f98838` |

## Acceptance-criteria traceability

| Criterion | Candidate evidence |
| --- | --- |
| 01 | Gate-range inventory, server-only composition, protected-surface blobs, and import scans. |
| 02–03 | Unit limit checks plus disposable selection/ordering/equality/exclusion matrix. |
| 04–05 | Twelve-client receipt/object races, early-theft denial, equality reclaim, and stale-owner isolation. |
| 06–07 | Wrong/expired/replaced-token matrix, atomic failure/release fault injection, and persisted retry schedule. |
| 08–09 | Serializable three-part projection rollback, binding/collision/TOCTOU checks, exact update CAS, and legacy assertions. |
| 10 | No-transport scan, injected fixture readers, and exact provider-argument spies. |
| 11 | Real-store negative reconciliation and hostile-error redaction matrix. |
| 12 | Same-receipt and same-object barriers, reversed delivery, current-snapshot convergence, and later retry success. |
| 13 | Empty/repeated/sequential/cancel/in-flight/poison/observer/store-fault tests and normal process cleanup. |
| 14–15 | Durable-state assertions, full A1 response regressions, frozen bounded summaries, and no-log/secret scans. |
| 16 | Repeatable disposable MySQL script, process-loss/outage/legacy coverage, and zero-leftover assertion. |
| 17 | Frozen install, Prisma, focused/full tests, lint, typecheck, build, evidence hashes, and immutable review chain. |
| 18 | Unwired-file rollback below plus every readiness state retained as FAIL. |

## Dependency evidence

- Installed-component inventory:
  `docs/evidence/CF-P1-B4F2A2-sbom.txt`.
- Inventory SHA-256:
  `6eea2a58cf6d0d63e47a45d83ae303c4d9cfa3a322106be754f232b155f7903b`.
- Bounded audit-service outage transcript:
  `docs/evidence/CF-P1-B4F2A2-audit-outage.json`.
- Outage transcript SHA-256:
  `8c73a94aee484585f36010b2f3609eee0c56b89aa337f703b5fd80526b747582`.
- Dependency summary:
  `docs/evidence/CF-P1-B4F2A2-dependency-evidence.json`.
- Dependency-summary SHA-256:
  `90bd5b565c6554c20ba0da318d23372309b08879652c5b17bff0973579b0e821`.
- Current lockfile SHA-256:
  `87503b664f64f829f664971fb17ff90407d00ab3cd4f2d4107324cad8616db43`.

Native Bun 1.3.11, the digest-recorded official Bun 1.3.11 container, and a
direct npm bulk-advisory POST returned no advisory JSON within their bounded
attempts. The acceptance controller permits these candidate-specific artifacts
only under `AMEND_B4F2A2_AUDIT_EVIDENCE_STALE_UNREVALIDATED`. This is not a
dependency-risk waiver. The sealed B4F1 count is historical same-lock
provenance, not a current finding. `CF-P1-AUDIT-FRESH-01` remains open.

## Rollback

Rollback removes only the A2 processing-store composition, run-once worker,
tests, synthetic fixture, proof/evidence tooling, and this record. B4F2A1's
disabled-by-default TEST intake and B4F1's domain/DDL evidence remain intact.
There is no route, scheduler, package, schema, migration, credential, provider,
deployment, or persistent data change to reverse.

## Remaining blockers

1. Freeze and independently review one exact implementation SHA, including the
   A2-specific audit amendment.
2. Seal accepted execution and lifecycle evidence before advancing.
3. Keep `CF-P1-AUDIT-FRESH-01` open until a fresh authoritative audit succeeds.
4. Obtain explicit future authorization and separate proof for representative
   schema/migration/backup/restore, worker hosting/availability, credentials,
   a real Stripe Test provider adapter/rehearsal, endpoint exposure, retention,
   Connect, Live Mode, tax, shared environments, or deployment.
5. Continue agency-platform checkpoints only after the Acceptance Orchestrator
   issues the next bounded advancement token.
