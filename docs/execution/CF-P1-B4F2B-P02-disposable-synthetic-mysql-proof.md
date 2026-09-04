# CF-P1-B4F2B-P02 — Disposable synthetic MySQL proof

## Checkpoint

- Accepted Boundary P contract layer:
  `33b29ddd80e198725605a85892fb6855437ab061`.
- P-02 work-item gate:
  `44deadc0e89616b31524efed6f70faa2c89e838c`.
- Architect work-item token: `APPROVE_B4F2B_P02_WORK_ITEM_GATE`.
- Verifier work-item token: `PASS_B4F2B_P02_WORK_ITEM_GATE`.
- Acceptance implementation clearance:
  `GO_B4F2B_P02_IMPLEMENTATION_CONFIRMED`.
- Accepted implementation SHA:
  `8f8ba7b8343b3bd53f9c852923ac803c5e049a32`.
- Architect implementation approval:
  `APPROVE_B4F2B_P02_CANDIDATE`.
- Independent implementation verification:
  `PASS_B4F2B_P02_CANDIDATE`.
- Acceptance seal clearance:
  `GO_B4F2B_P02_CANDIDATE_SEAL`.
- Branch: `codex/crewframe-foundation`.
- Status: `EXECUTION_SEAL_CANDIDATE_AWAITING_VERIFICATION`.
- Original candidate:
  `1ddcddeeb68f91e530aaf9b6af2c26556028f852`.
- Original Architect decision: `APPROVAL_WITHHELD` for unbounded Docker
  execution, ambiguous-run cleanup, non-positive volume absence, and
  intermediate reparse handling.
- Original Verifier decision: `HOLD` / `P02-V1` through `P02-V4` for the same
  independently identified cleanup, path-safety, and bounded-execution gaps.
- P-02 remediation rounds used: 1 of 2.
- Boundary R: `BLOCKED`.

## Outcome

P-02 adds a zero-argument, local-only PowerShell proof that exercises the
unchanged B4D logical-plan and B4F1 webhook-inbox SQL drafts against an exact,
already-local MySQL 8.4 image. It uses only generated synthetic schemas and
values, publishes no port, uses no network, accepts no caller or ambient
connection authority, requests no mount, and retains no container or volume.

The proof does not access representative metadata or data, a credential,
provider, host database, application runtime, shared environment, or
deployment. It does not create a Prisma migration or make either SQL draft
applyable. Permission DDL remains `DESIGN_REQUIRED` and Boundary R remains
blocked.

## Fixed runtime and inputs

- Image digest and image ID:
  `sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb`.
- Platform: `linux/amd64`.
- Pull policy: `never`.
- Network: `none`; published ports: 0; requested mounts: 0.
- P-02 work-item SHA-256:
  `2e0928f6ad5f63f5305a9be241eeecfa42e863042dcc0f70163c906907666c4f`.
- Boundary P manifest SHA-256:
  `6f7cf321bdd9706065549d6889fee4ce9e6dbb091df36398924708d1b9495855`.
- Synthetic fixture SHA-256:
  `196913a510fc2165c2f4d1ed649a6b6a94124150a8a8f3d09654c913a291d52e`.
- B4D SQL SHA-256:
  `986397f506dcf9f9d1d163ddda6e403abdcec98da3edfb5dc172a2f279eb6fe7`.
- B4F1 SQL SHA-256:
  `66195477220c545cc75efad4d269443ff0cc0492e2631e6a113cbee6f0f9621d`.

Before container creation, the orchestrator validates these exact content
hashes and recomputes every protected Git blob from the accepted Boundary P
manifest. It rejects all arguments and the presence of database, URL,
credential, Docker-host/context/TLS, MySQL-host/port/password, or
representative-selector configuration without reading or echoing its value.

## Proof results

The logical-plan success schema contains five generated rows and preserves all
five legacy prices and four non-null legacy plan values. The proof applies the
unchanged B4D draft, validates the intended nullable enum, and performs a
proof-only backfill with one BASIC mapping, one UNLIMITED mapping, two unmapped
rows, and one preserved conflict. Reapplication and an incompatible
pre-existing `logicalPlan` column are both rejected.

The webhook success schema applies the unchanged B4F1 draft and validates
three tables, 40 columns with exact type/nullability, 20 index entries, seven
explicit defaults, zero collation mismatches, and zero raw-payload columns.
Duplicate receipt and object-identity inserts are rejected. A deliberately
incompatible pre-existing Receipt table demonstrates that conditional create
statements cannot mask a structural mismatch.

MySQL's temporary initialization server can briefly report healthy before the
final server is ready. The orchestrator therefore waits for ping, allows the
temporary server to exit, then requires a stable `SELECT 1` with bounded
retries before applying any fixture or draft. This closes the observed startup
race without exposing diagnostic or server output.

## Failure isolation and cleanup

The image-declared `/var/lib/mysql` anonymous volume is derived only from the
exact generated container. Both the successful scenario and a second scenario
with deterministic `EXPECTED_INJECTED_FAILURE` remove the exact container with
`--volumes` in `finally` paths. Each exact anonymous volume is then required to
be absent, and an independent fixed-label query must return zero matching
containers.

Final bounded cleanup evidence records:

- success containers: 0;
- success retained volumes: 0;
- injected-failure containers: 0;
- injected-failure retained volumes: 0;
- dumps: 0;
- temporary files: 0; and
- open handles: 0.

No broad Docker enumeration is used as a deletion target, and no prune,
bind-volume, named-volume, network, or host cleanup action is allowed.

Every Docker subprocess and standard-input write has a 30-second bound;
standard-output/error completion and whole-process-tree termination each have
a 5-second bound. The proof tracks every started Docker process handle and will
not emit evidence unless the active count returns to zero. Before `docker run`,
the generated exact name must be absent. After run is invoked, the proof
reconciles that exact name over a bounded interval, requires the fixed proof
label and image identity, captures a strict 64-hex anonymous-volume identity
before any isolation assertion, and authorizes cleanup only because the same
name was proven absent beforehand. A pre-existing collision is never deleted.

Container and volume absence are positive, exit-zero daemon queries. A query
failure is not treated as absence. If run returns a failure, malformed output,
or times out after creating the container, the same exact reconciliation and
cleanup path still runs before the proof can fail.

## Evidence contract

`docs/evidence/CF-P1-B4F2B-P02-synthetic-mysql.json` contains only fixed input
hashes, the fixed image identity, finite states, bounded aggregate counts,
Boolean invariant outcomes, and zero cleanup counts. Its SHA-256 is
`a522fd9d21984b208a720f356d735fb508997e02ec293b8aeef8e1a2479006ef`.

It contains no container or volume identity, host, path, command, environment
value, credential, connection string, database URL, schema value, provider or
record identifier, row value, tenant/user identifier, free-form error, or
Docker/MySQL output. The console emits one fixed success line or one fixed
failure line.

## Verification

- Focused P-02 tests: 11 passed, 0 failed, 93 expectations.
- P-02 plus Boundary P continuity tests: 20 passed, 0 failed, 134
  expectations.
- Complete `bun test`: 297 passed, 0 failed, 1,356 expectations across 41
  files.
- `bun run lint`: pass with no warnings or errors.
- `bun run typecheck`: pass.
- `bun run build`: pass; compilation and 13/13 static-page generation
  completed.
- `git diff --check`: pass.
- Repeated zero-argument proof: pass with the fixed success line and
  byte-identical evidence SHA-256
  `a522fd9d21984b208a720f356d735fb508997e02ec293b8aeef8e1a2479006ef`.
- Argument and ambient-configuration denial tests: pass with generic output
  and no marker echo.
- Source scans: no diagnostic, log, broad cleanup, shell-string evaluation,
  network, mount, published-port, permission-DDL, or representative-data
  adapter.
- Intermediate fixed-input and evidence-output junction regressions: generic
  fail-closed result before Docker, with outside sentinels unchanged.
- Exact protected package, lockfile, Prisma schema/migration, route,
  middleware, worker, provider, runtime-configuration, and SQL surfaces remain
  unchanged.

Independent verification used a detached exact-SHA worktree, passed frozen
installation, and observed the Docker volume inventory unchanged at 72 across
both proof runs, with zero labeled containers, evidence temporary files, or
surviving proof PowerShell processes. On Windows with `core.autocrlf`, a fresh
checkout may materialize the tracked JSON evidence with CRLF until the mandated
proof-first sequence rewrites canonical LF. The proof-first sequence and the
immutable Git blob both produce the accepted SHA-256 above; this observation
does not change evidence content, acceptance, or any dependency/readiness
classification.

The immutable exact-candidate review must independently rerun the proof,
confirm byte-identical evidence, and recheck zero runtime residue before this
checkpoint can be accepted.

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
- Representative state: `NOT_ACCESSED`.
- Permission stage: `DESIGN_REQUIRED`.
- Boundary R: `BLOCKED`.

P-02 changes no readiness state and grants no representative or deployment
authority.

## Rollback

Rollback removes only the P-02 proof orchestrator, static synthetic fixture,
focused tests, deterministic evidence, and this execution record. Runtime
rollback is exact generated-container removal with its exact image-created
anonymous volume. No package, lockfile, Prisma schema or migration, SQL draft,
route, middleware, worker, provider, runtime, credential, deployment, or
persistent data state exists to reverse.

## Next gate

Independently verify this documentation-only execution-seal child and require
`PASS_B4F2B_P02_SEAL` against its exact immutable SHA. Only then may a separate
one-file lifecycle-seal child change the P-02 issue from `READY` to `DONE` with
historical execution authority only. The parent B4F2B issue remains `READY`;
Boundary R and every dependency-audit/readiness hold remain blocked regardless
of the P-02 seal result.
