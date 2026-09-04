# CF-P1-B4F2B-P02 — Disposable synthetic MySQL proof

## Problem

The accepted B4F2B Boundary P contract layer proves the repository-only plan,
input hashes, protected surfaces, closed authorization/evidence shapes, and
execution holds. It does not yet prove that the unchanged B4D and B4F1 SQL
drafts behave as intended on the repository's declared MySQL family, reject
incompatible pre-existing structures, preserve legacy columns, or clean up
after both success and injected failure.

## Goal

Create one repeatable, local, disposable, synthetic-only MySQL 8.4 proof for
the two unchanged SQL drafts. The proof must use no caller input, ambient
connection configuration, network, published port, bind mount, named volume,
representative metadata or data, provider, application runtime, or deployable
migration. It must leave no matching container, volume, dump, temporary file,
or process handle after success or failure.

## Authority and immutable inputs

- Accepted Boundary P contract layer:
  `33b29ddd80e198725605a85892fb6855437ab061`.
- Original Boundary P gate:
  `ab10c304d0a94b26ccfa460c6cb2dff8c4fe1f93`.
- Architect token:
  `APPROVE_B4F2B_BOUNDARY_P_CONTRACT_LAYER`.
- Verifier token:
  `PASS_B4F2B_BOUNDARY_P_CONTRACT_LAYER`.
- Acceptance token:
  `GO_B4F2B_P02_DISPOSABLE_SYNTHETIC_MYSQL_PROOF`.
- P-01 remediation rounds used: 1 of 2.
- P-02 remediation allowance: 2 rounds.
- Branch: `codex/crewframe-foundation`.

## Fixed local image

- Repository/tag observed locally: `mysql:8.4`.
- Required immutable digest:
  `mysql@sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb`.
- Image ID:
  `sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb`.
- Platform observed locally: `linux/amd64`.
- Pull policy: `never`; absence or identity mismatch is a hard stop.
- The image declares `/var/lib/mysql` as an anonymous data volume. P-02 may
  neither request nor retain a bind, named, or persistent volume. The
  image-created anonymous volume must be identified from the exact container,
  removed with that container in every path, and proven absent afterward. If
  this unavoidable image behavior is not accepted by Architect, Verifier, and
  Acceptance review, P-02 stops without starting a container.

## Allowed implementation

P-02 may add only:

- a narrowly scoped PowerShell proof orchestrator;
- static generated synthetic SQL fixtures containing no copied application or
  representative values;
- focused Bun tests for its contract and denial boundaries;
- deterministic bounded aggregate/hash evidence; and
- a P-02 execution record.

The proof may invoke only the local Docker CLI against the exact daemon already
available on this workstation. It may create randomly suffixed containers with
the fixed label `com.crewframe.proof=CF-P1-B4F2B-P02`, use `--pull=never` and
`--network=none`, and execute MySQL commands only inside the exact generated
container. It may use a fixed empty root password solely inside the isolated,
non-routable, no-port synthetic container so no generated or ambient credential
is accepted, logged, or retained.

The orchestrator must accept zero arguments and reject the presence of ambient
database, URL, credential, Docker-host/context/TLS, MySQL-host/port/password,
or representative selector configuration without reading or echoing its value.
It may read only fixed repository files and must validate their exact hashes
before container creation.

## Required proof matrix

### Baseline and logical plan

1. Create a minimal synthetic `Subscription` table with the current legacy
   `plan` and `price` columns and the B4D prerequisite columns.
2. Insert only finite generated rows covering BASIC, UNLIMITED, null, unknown,
   and conflicting logical-plan mapping categories.
3. Apply the unchanged B4D draft exactly once.
4. Prove `logicalPlan` exists with the intended nullable enum structure and
   that every legacy column and pre-existing synthetic value remains present.
5. Perform only a proof-local synthetic backfill derived from the accepted
   category map, prove expected aggregate results, and retain the draft itself
   unchanged and non-applyable.
6. Reapplying B4D or applying it to a deliberately incompatible pre-existing
   `logicalPlan` column must fail closed without being reported as success.

### Webhook inbox

1. Apply the unchanged B4F1 draft to a clean synthetic schema.
2. Inspect every expected table, column type/nullability/default, index, and
   composite uniqueness rule explicitly; table existence is insufficient.
3. Prove duplicate receipt and object-identity keys are rejected and bounded
   synthetic inserts contain no raw provider payload or representative value.
4. Start from an intentionally incompatible pre-existing webhook table, apply
   B4F1, and prove `CREATE TABLE IF NOT EXISTS` does not mask the mismatch: the
   post-DDL structure validator must fail the proof.

### Permission stage

The permission migration remains `DESIGN_REQUIRED`. No permission DDL,
backfill, uniqueness change, or representative inference may be created or run.

### Failure and cleanup

- Inject a deterministic failure after container creation and before proof
  completion.
- Remove only the exact generated container with its anonymous volume in a
  `finally` path; never enumerate a broad target for deletion.
- Independently query the fixed proof label/name after success and failure and
  require zero matching containers and volumes.
- Require zero repository or temporary dumps, decrypted files, evidence temp
  files, or running proof child processes after every path.

## Evidence contract

Evidence may contain only:

- fixed contract and SQL SHA-256 values;
- fixed image digest;
- finite stage/category enums;
- bounded aggregate counts;
- Boolean structural/invariant results;
- bounded duration integers; and
- cleanup counts that must equal zero.

Evidence must not contain a container ID/name, volume ID/name, host, path,
command, environment value, credential, connection string, database URL,
schema value, provider identifier, record identifier, row value, tenant/user
identifier, free-form error, or Docker/MySQL log output. Console output is one
fixed success line or one fixed failure line.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| P02-01 | Exact local image digest is present before execution; pull is disabled and no image/build/network acquisition occurs. |
| P02-02 | Tool rejects every argument and every ambient connection/configuration key without echo or side effect. |
| P02-03 | Container is random-suffixed and fixed-labeled, uses no network or published port, accepts no mount argument or named volume, and is removed with its image-created anonymous volume. |
| P02-04 | Only fixed hash-verified B4D and B4F1 drafts and fixed synthetic fixtures are read; drafts remain unchanged and non-applyable. |
| P02-05 | B4D proof validates additive `logicalPlan`, legacy preservation, bounded synthetic backfill categories, and fail-closed repeat/incompatible-column behavior. |
| P02-06 | B4F1 proof validates exact columns/indexes/uniqueness and detects an incompatible existing table despite conditional create statements. |
| P02-07 | Permission stage remains `DESIGN_REQUIRED` and no permission DDL exists. |
| P02-08 | Success and injected-failure paths both leave zero matching containers, anonymous/named volumes, dumps, temporary files, or handles. |
| P02-09 | Evidence is deterministic, finite, aggregate-only, hash-bound, and passes secret/stable-identifier/log scans. |
| P02-10 | Focused/full tests, lint, typecheck, build, protected-surface continuity, and immutable exact-SHA review pass. |
| P02-11 | Boundary R and every dependency-audit/readiness hold remain unchanged. |

## Stop conditions

- Required digest is unavailable or does not map to the expected image ID.
- Docker daemon target is non-local, context/TLS/host configuration is present,
  or Docker would pull/build/use a network.
- Any argument, selector, URL, credential, connection setting, mount request,
  named volume, port publication, representative artifact, or unbounded output
  is proposed.
- Fixed fixture, SQL, manifest, validator, or protected-surface hash changes.
- MySQL engine/version, DDL, column, index, uniqueness, legacy, backfill, or
  cleanup invariant differs from the closed expectation.
- Cleanup cannot prove zero leftovers, or a failure cannot be represented by a
  finite code without retaining raw logs.
- Work expands into permission DDL, Prisma/schema/migrations, application
  runtime, provider, shared environment, deployment, or Boundary R.

## Forbidden surfaces

No package/lockfile, Prisma schema/migration, B4D/B4F1 SQL, route, middleware,
worker, provider, environment file, CI, deployment, persistent database,
representative metadata/data, backup, restore, password manager, credential,
host database connection, application runtime, shared environment, broad
Docker cleanup, or destructive external operation may change or run.

## Rollback

Rollback removes only P-02 proof code, generated synthetic fixtures, focused
tests, deterministic evidence, and its execution record. Runtime rollback is
exact generated-container removal with its exact image-created anonymous
volume. No persistent or representative state exists to reverse.

## Readiness posture

- Dependency audit: `STALE_UNREVALIDATED`.
- Current advisories: `UNKNOWN`.
- `CF-P1-AUDIT-FRESH-01`: open.
- Local application readiness: `FAIL`.
- Shared development readiness: `FAIL`.
- Staging readiness: `FAIL`.
- Pilot readiness: `FAIL`.
- Production readiness: `FAIL`.
- Public-runtime readiness: `FAIL`.
- Boundary R: `BLOCKED`.

## Status

`READY`

## Execution gate

- `P-02: ALLOWED` only after this exact work item receives Architect,
  Verifier, and Acceptance gate confirmation.
- `Boundary R: BLOCKED`.

## Human input

None for P-02. Human, database-owner, and data/security-owner authorization is
still mandatory before every Boundary R action.
