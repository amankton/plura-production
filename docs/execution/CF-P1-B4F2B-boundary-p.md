# CF-P1-B4F2B — Boundary P offline contract layer

## Checkpoint

- Accepted B4F2A2 lifecycle seal:
  `6a6a430216f6d350ff8d235a405e613880efa459`.
- B4F2B intake-contract SHA:
  `a092bd012419cc2e847d6db0a24d2b1abe936d6c`.
- Boundary P gate SHA:
  `ab10c304d0a94b26ccfa460c6cb2dff8c4fe1f93`.
- Architect intake token: `APPROVE_B4F2B_INTAKE_CONTRACT`.
- Verifier intake token: `PASS_B4F2B_INTAKE_CONTRACT`.
- Acceptance tokens: `GO_B4F2B_BOUNDARY_P_IMPLEMENTATION` and
  `GO_B4F2B_BOUNDARY_P_IMPLEMENTATION_CONFIRMED`.
- Branch: `codex/crewframe-foundation`.
- Status: `CANDIDATE_AWAITING_EXACT_REVIEW`.
- Boundary R: `BLOCKED`.
- Maximum remediation rounds: 2.

## Outcome

This intermediate Boundary P checkpoint creates a fixed-input, zero-argument,
offline contract layer before any disposable synthetic MySQL proof is allowed.
It freezes the gate inputs and protected surfaces, encodes the ordered migration
planning graph, provides closed authorization and evidence shapes, and emits a
deterministic repository-only inventory.

It does not access a credential, connection setting, host, network, database,
representative schema or metadata, backup, restore, provider, application
runtime, or deployment. It neither imports nor invokes the two existing
database-reading preflight wrappers. It does not execute either SQL draft.

## Contract artifacts

- The versioned manifest defines P0 through P11 as an acyclic graph with exact
  dependencies, plan and execution dispositions, mutation boundaries, SQL
  references, lock-risk classifications, rollback/re--restore requirements,
  invariants, stop codes, and source references.
- Only P5 and P8 may later use the existing SQL drafts, and then only against a
  disposable synthetic MySQL instance under a separately reviewed Boundary P
  proof. Every representative operation remains `BLOCKED_BOUNDARY_R`.
- Permission `userId` expansion and backfill remain `DESIGN_REQUIRED`; no
  permission DDL is invented or approved here.
- The closed JSON schema rejects unknown properties and requires every declared
  object field. Evidence records are finite, enum-bounded, aggregate-only, and
  have no free-form diagnostic field.
- The blank Boundary R authorization packet contains no source, target, owner,
  credential, location, or operational identity. Its local validator can return
  only `INVALID`, `INCOMPLETE`, or
  `COMPLETE_AWAITING_EXTERNAL_APPROVAL`; it can never authorize execution.
- The blank Boundary R evidence packet contains no run or structural
  fingerprint and no record. It permits bounded counts, durations, exit states,
  structural categories, and SHA-256 fingerprints only.

## Fail-closed validator

`scripts/verify-b4f2b-boundary-p.ts`:

- accepts no arguments, selectors, URLs, credentials, or configuration;
- rejects the presence of known database and container connection environment
  keys without reading or echoing their values;
- reads only a compiled allowlist of repository-relative files;
- rejects symlinked files, non-files, and paths that resolve outside the real
  repository root;
- verifies normalized SHA-256 identities for the six source artifacts;
- recomputes Git blob identities for eleven protected surfaces, including the
  binary lockfile, against the Boundary P gate;
- proves the schema is closed, the authorization template is incomplete, the
  evidence template is blank, and the stage graph is forward-only;
- rejects non-expand data-mutation statements in the existing SQL drafts; and
- writes only the fixed deterministic offline inventory after every validation
  succeeds. Failure output is one generic line with no rejected input value.

## Repository findings

- Prisma provider: MySQL.
- Prisma relation mode: `prisma`; synthetic DDL therefore cannot claim foreign
  key coverage.
- Prisma migration baseline: absent; the empty local migrations directory is
  not a versioned baseline.
- `Permissions.userId`: absent from the current Prisma model.
- Subscription `logicalPlan` and the three webhook inbox models: declared in
  Prisma.
- The B4D logical-plan and B4F1 webhook SQL files remain non-applyable drafts.
- `CREATE TABLE IF NOT EXISTS` in B4F1 cannot establish representative
  compatibility because it may mask an incompatible existing structure; the
  later synthetic proof must inspect the resulting columns and indexes
  explicitly.

These findings describe repository files only. They are not representative
database findings.

## Verification

- Focused Boundary P contract tests: 8 passed, 0 failed, 36 expectations.
- `bun run typecheck`: pass.
- `bun run lint`: pass with no warnings or errors.
- Complete `bun test`: 285 passed, 0 failed, 1,258 expectations across 40
  files.
- `bun run build`: pass; compilation and 13/13 static-page generation
  completed.
- `git diff --check`: pass.
- The CLI success path is repeated and produces byte-identical evidence.
- Argument and ambient-configuration denial paths produce only the generic
  failure line and do not echo the supplied marker.
- Source and protected-surface drift, open schemas, graph cycles, executable
  dispositions, unexpected authorization fields, and row-level evidence fields
  are rejected in focused tests.
- Source scan finds no database client import, network transport, process or
  shell adapter, provider adapter, Docker/MySQL command, or password-manager
  adapter in the validator and its pure contract library.
- Frozen dependency installation and Prisma generation/validation are deferred
  to the independent immutable-candidate review so this implementation pass
  neither uses network access nor supplies a database connection setting.

## Readiness and holds

- Dependency audit: `STALE_UNREVALIDATED`.
- Current dependency-advisory state: `UNKNOWN`.
- `CF-P1-AUDIT-FRESH-01`: open hard gate.
- Local application readiness: `FAIL`.
- Shared development readiness: `FAIL`.
- Staging readiness: `FAIL`.
- Pilot readiness: `FAIL`.
- Production readiness: `FAIL`.
- Public-runtime readiness: `FAIL`.

This contract-layer candidate does not change any readiness state. Boundary R
still requires an exact versioned authorization packet, a new execution gate,
named source and target fingerprints, human operator authorization, database
owner authorization, data/security owner authorization, and new Architect,
Verifier, and Acceptance approvals.

## Rollback

Rollback removes only this Boundary P manifest, schema, blank templates,
offline inventory, validator, pure contract library, focused tests, and this
record. No package, lockfile, Prisma schema or migration, SQL draft, route,
middleware, worker, provider, environment, runtime, deployment, credential, or
persistent-data action exists to reverse.

## Next gate

Freeze this candidate and obtain exact Architect and Verifier reviews. The
Acceptance Orchestrator may clear a disposable synthetic-only MySQL proof only
when both reviews pass the same immutable SHA. Boundary R remains blocked
regardless of that result.
