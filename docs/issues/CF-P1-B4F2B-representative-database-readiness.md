# CF-P1-B4F2B — Representative database readiness and migration rehearsal

## Problem

Crewframe now has locally proven tenant authority, billing authority, additive
logical-plan and webhook DDL drafts, disabled TEST webhook intake, and an
unwired TEST-only processor. The repository does not yet have authoritative
evidence describing the real database schema, drift, legacy anomalies, backup
recoverability, migration baseline, or rollback behavior. Connecting the
application or applying repository drafts without that evidence could corrupt
tenant, permission, subscription, or webhook authority.

## Goal

Create a controlled, independently reviewed path from read-only representative
database characterization to a migration rehearsal performed only on an
isolated restored clone. Prove backup, restore, compatibility, rollback, data
handling, and failure behavior before any persistent environment or application
runtime can be considered for a later change window.

This intake creates only the contract. It authorizes no credential access,
database connection, backup, restore, schema introspection, migration,
application connection, shared environment, or persistent mutation.

## Owner and prerequisites

- Planning owner: Codex primary agent.
- Architecture reviewer: Crewframe Agency Architect.
- Independent verifier: Crewframe Verifier.
- Acceptance authority: Crewframe Acceptance Orchestrator.
- Accepted B4F2A2 lifecycle seal:
  `6a6a430216f6d350ff8d235a405e613880efa459`.
- Intake token: `GO_B4F2B_INTAKE`.
- Intake-contract SHA: `a092bd012419cc2e847d6db0a24d2b1abe936d6c`.
- Architect intake approval: `APPROVE_B4F2B_INTAKE_CONTRACT`.
- Verifier intake approval: `PASS_B4F2B_INTAKE_CONTRACT`.
- Boundary P implementation clearance:
  `GO_B4F2B_BOUNDARY_P_IMPLEMENTATION`.
- B4F2A2 is local-only and unwired.
- Dependency audit is `STALE_UNREVALIDATED`; current advisories are `UNKNOWN`.
- `CF-P1-AUDIT-FRESH-01` remains open and every shared, public, deployed, or
  release-ready posture remains blocked.
- A named database owner, security/data owner, and authorized human operator
  must approve any later representative-data action.

## Two-boundary execution model

### Boundary P — safe preflight planning

Boundary P is repository documentation and local synthetic analysis only. It
may inventory existing Prisma models, non-applyable SQL drafts, read-only
preflight code, required metadata, proposed commands, expected outputs,
rollback steps, evidence templates, and approval gates. It may use generated
schemas and disposable synthetic MySQL only.

Boundary P must not access a password manager, environment secret, connection
string, database host, provider console, backup, snapshot, dump, log, shared
environment, or representative row/schema metadata. It must not add an
applyable migration or change application runtime behavior.

### Boundary R — credentialed isolated rehearsal

Boundary R is future work and remains separately blocked. It may begin only
after a versioned child gate records exact Architect, Verifier, Acceptance, and
human authorization for a named non-production source and isolated rehearsal
target. Authorization must state the permitted operations, owner, time window,
data classification, retention/deletion rules, and rollback stop conditions.

Any Boundary R source access starts read-only. Migration SQL may run only on a
verified isolated restore, never on the representative source. Source backups,
restore targets, or credentials may not be created, accessed, or changed under
this intake token.

## Candidate migration inventory

Boundary P must reconcile, without applying, at least:

- the current `prisma/schema.prisma` and the representative migration baseline;
- `ADR-0001-permission-user-id-migration.md` and the existing permission
  migration preflight;
- `CF-P1-B4D-logical-subscription-plan-expand.sql` and the existing
  subscription-plan preflight;
- `CF-P1-B4F1-webhook-inbox-foundation.sql`;
- legacy Subscription `plan`/`price` preservation and current `logicalPlan`,
  `priceId`, `customerId`, `subscritiptionId`, and `agencyId` constraints;
- tenant, permission, Customer, subscription, and connected-account uniqueness
  and foreign-key assumptions; and
- database engine/version, collation, SQL mode, timezone, index, trigger,
  charset, table-size, and lock-risk compatibility.

Discovery may identify additional drift. It may not silently widen the future
mutation scope; every new schema or data transformation requires a versioned
contract amendment.

## Data classification and handling

- Database credentials, connection strings, encryption keys, provider tokens,
  and backup locations are secrets. They may never enter repository files,
  prompts, command output, logs, shell history, evidence, screenshots, or chat.
- Representative rows, dumps, backups, emails, names, addresses, payment
  references, provider IDs, tenant IDs, and free-form content are confidential.
  They may not be copied into the repository or evidence artifacts.
- Read-only schema metadata is restricted operational information. Evidence may
  retain only approved structural fingerprints, aggregate counts, bounded
  anomaly categories, durations, exit states, and cryptographic checksums.
- Row-level diagnostics must be computed in place and serialized only as
  redacted aggregate categories. No raw value, sample row, or stable record ID
  may leave the authorized boundary.
- An isolated rehearsal restore must use encrypted storage, least-privilege
  credentials, network restriction, an explicit deletion deadline, and a
  recorded cleanup verification. De-identification is required when it can be
  performed without invalidating the migration proof.
- No production payment card data, raw Stripe payload, authentication secret,
  or user content is required or permitted for this rehearsal.

## Required future authorization packet

Before Boundary R, the issue must gain a child record containing:

- exact source environment and proof that it is non-production or an approved
  read-only production snapshot source;
- exact isolated restore target and proof it cannot receive production traffic;
- named database owner, data/security owner, and human operator approval;
- least-privilege read and restore/migration roles kept separate;
- allowed commands/operations and a fixed maintenance/rehearsal window;
- backup method, encryption, checksum, retention, and deletion owner;
- recovery point and recovery time expectations;
- output redaction and evidence-retention rules;
- stop/abort contacts and incident path; and
- exact Architect, Verifier, and Acceptance execution tokens.

Authorization for one source/target pair cannot be reused for another.

## Planned rehearsal sequence

1. Confirm owners, scope, data classification, audit posture, and exact source
   and target identities without disclosing secrets.
2. Use a least-privilege read-only role to capture bounded engine and schema
   fingerprints plus aggregate preflight categories.
3. Create or identify an owner-approved encrypted backup and verify its size,
   timestamp, checksum, retention, and restore instructions.
4. Restore into a new isolated, non-routable target and verify its source
   checksum/fingerprint lineage. Never reuse an application-connected database.
5. Run read-only drift and anomaly preflights on the isolated restore. Stop on
   unclassified drift, cross-tenant violations, duplicates, unmapped legacy
   values, missing ownership, broken constraints, or unsafe volume/lock risk.
6. Establish a migration baseline and generate a reviewed expand-only rehearsal
   plan. Destructive contract steps remain outside B4F2B.
7. Apply one ordered migration stage at a time to the isolated restore with
   before/after structural fingerprints, bounded aggregate invariants, timing,
   locks, and failure capture.
8. Run compatibility checks with external providers, webhooks, workers,
   schedulers, email, and background jobs disabled. Application access, if later
   authorized, uses only the isolated target and TEST-safe configuration.
9. Exercise injected failure and rollback/compensation at each stage. Prove a
   clean re-restore from the verified backup rather than relying only on reverse
   SQL for additive or data-transforming steps.
10. Destroy the rehearsal target and any temporary decrypted material by the
    approved deadline, revoke temporary roles, and independently confirm
    cleanup. The encrypted source backup follows its approved retention policy.

## Stop conditions

- Missing or ambiguous human, database-owner, or data/security authorization.
- Any credential or secret appears in a repository artifact, prompt, log, or
  command output.
- Source or target identity is ambiguous, production traffic can reach the
  target, or write capability exists on a read-only source role.
- Backup timestamp, encryption, checksum, ownership, retention, or restore
  procedure cannot be verified.
- Restore lineage or structural fingerprint does not match the authorized
  source backup.
- Preflight reveals unclassified drift, unsafe tenant/permission ownership,
  unknown legacy plan data, duplicate provider bindings, or blocking anomalies.
- Migration requires destructive contraction, unbounded locks, table rebuilds,
  provider calls, route/scheduler enablement, or scope not recorded here.
- Bounded evidence cannot be produced without exposing row values or stable
  sensitive identifiers.
- Rollback, clean re-restore, or cleanup cannot be demonstrated.
- Any shared application-runtime test is proposed while
  `CF-P1-AUDIT-FRESH-01` remains open.

## Acceptance criteria

| ID | Pass/fail criterion | Required evidence |
| --- | --- | --- |
| CF-P1-B4F2B-01 | Boundary P changes only versioned plans, synthetic fixtures/proofs, and redacted evidence; no credentials, database/network access, schema, migration, package, runtime, route, or deployment change occurs. | Exact parent-range diff, protected-surface hashes, import/network and secret scans. |
| CF-P1-B4F2B-02 | Boundary R cannot start without the exact authorization packet and new implementation gate. | Versioned owner/human/Architect/Verifier/Acceptance approvals and fail-closed tooling tests. |
| CF-P1-B4F2B-03 | Source access is read-only and target identity is isolated, non-production, non-routable, and not application-connected. | Role grants, source/target fingerprints, network and runtime checks with secrets redacted. |
| CF-P1-B4F2B-04 | Backup is encrypted, timestamped, checksummed, owner-approved, retained by policy, and demonstrably restorable. | Provider/native backup metadata, SHA-256, restore transcript, and owner attestation without paths or credentials. |
| CF-P1-B4F2B-05 | Schema drift is classified across Prisma, migration baseline, engine settings, tables, columns, constraints, indexes, triggers, collation, and charset. | Read-only normalized structural diff and approved drift disposition. |
| CF-P1-B4F2B-06 | Permission and subscription preflights report only bounded aggregate anomaly categories and block on unresolved authority or legacy mapping defects. | Redacted aggregate reports and zero-blocker gate. |
| CF-P1-B4F2B-07 | The B4D, B4F1, and any prerequisite permission stages have an ordered expand-only plan with lock, runtime, compatibility, and rollback analysis. | Reviewed stage graph and per-stage change/stop table. |
| CF-P1-B4F2B-08 | Migration stages run only on the isolated restore and preserve tenant, permission, Customer, subscription, legacy, and webhook invariants. | Before/after fingerprints, aggregate invariants, affected-row bounds, and target identity checks. |
| CF-P1-B4F2B-09 | Application compatibility runs only with providers and background execution disabled and cannot reach source, production traffic, Live Mode, or external side effects. | Denial traps, configuration proof, connection fingerprint, focused/full tests. |
| CF-P1-B4F2B-10 | Injected failures leave no ambiguous stage, and rollback or clean re-restore succeeds within recorded expectations. | Per-boundary failure matrix, re-restore proof, checksums, and timing. |
| CF-P1-B4F2B-11 | Evidence contains no secrets or row-level representative data; outputs are finite, redacted, and independently reproducible. | Secret/PII/stable-ID scans, schema validation, hashes, and verifier reproduction. |
| CF-P1-B4F2B-12 | Temporary targets/material are destroyed, temporary roles revoked, and no handles, containers, volumes, dumps, or decrypted files remain. | Exact cleanup inventory and independent zero-leftover check. |
| CF-P1-B4F2B-13 | All project tests/builds and relevant migration compatibility checks pass on one immutable candidate without changing dependency or advisory posture. | Frozen install, Prisma validate/generate, lint, typecheck, tests, build, dependency continuity, and exact SHA reviews. |
| CF-P1-B4F2B-14 | Execution and lifecycle seals preserve `STALE_UNREVALIDATED`, `UNKNOWN`, all readiness states `FAIL`, open `CF-P1-AUDIT-FRESH-01`, and every external-action boundary. | Documentation-only seal chain and acceptance tokens. |

## Non-goals and forbidden surfaces

- No credential retrieval, secret configuration, representative database
  connection, metadata query, backup, snapshot, dump, restore, or mutation.
- No change to `prisma/schema.prisma`, `prisma/migrations`, existing B4D/B4F SQL
  drafts, packages, lockfile, environment files, routes, middleware, workers,
  providers, schedulers, deployment, CI, hosting, or shared runtime.
- No production write, destructive SQL, contract/drop/rename step, data purge,
  provider operation, Stripe CLI/API call, endpoint exposure, Live Mode, or tax.
- No representative row data, credentials, dumps, connection strings, provider
  IDs, tenant IDs, emails, user content, or stable sensitive identifiers in Git.
- No CRM/Odoo integration, data import, ownership cutover, or source-of-truth
  change.
- No closure or waiver of `CF-P1-AUDIT-FRESH-01`.

## Rollback

Boundary P rollback is a documentation-only revert. A future Boundary R child
must define exact cleanup and restore operations for its authorized source and
target before execution. Reverse SQL alone is not an acceptable backup or
rollback strategy.

## Readiness posture

B4F2B intake does not change readiness. Local application, shared development,
staging, pilot, production, and public-runtime readiness remain `FAIL`.
Dependency audit remains `STALE_UNREVALIDATED`, current advisories remain
`UNKNOWN`, and `CF-P1-AUDIT-FRESH-01` remains open.

## Status

`READY`

## Execution Gate

- `Boundary P: ALLOWED` — versioned plans, runbooks, approval/evidence
  templates, offline inventory, fail-closed local tooling, focused tests, and
  disposable synthetic-only MySQL proof within this issue's contract.
- `Boundary R: BLOCKED` — no password-manager access, secret, connection
  string, network/database connection, representative metadata, backup,
  restore, migration, application/shared runtime, provider operation,
  deployment, or destructive action is authorized.

## Target environment

Current intake: repository documentation only. Future rehearsal: one expressly
authorized, isolated, non-production restore target only.

## Maximum remediation rounds

`2`

## Human input

None for this intake issue. Explicit human authorization is mandatory before
any password-manager access, credential use, representative metadata query,
backup, restore, migration, application connection, shared environment, or
destructive/irreversible operation.
