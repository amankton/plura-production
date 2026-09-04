# CF-P1-B5A1 — Closed agency authority inventory

## Objective

Create a deterministic, machine-checked inventory of every authority-bearing
server surface in the Crewframe agency application. B5A1 records what exists,
how each surface obtains identity and ownership, and which later B5A child owns
its remediation. It changes no production behavior.

## Immutable authority

- Accepted intake SHA:
  `5d899d7cae64711a4be2063a0ace2215997ad7be`.
- Intake Architect token:
  `APPROVE_B5A_AGENCY_AUTHORITY_CLOSURE_INTAKE`.
- Intake Verifier token:
  `PASS_B5A_AGENCY_AUTHORITY_CLOSURE_INTAKE`.
- Intake Acceptance token: `ACCEPT_B5A_INTAKE_AND_PUSH`.
- B5A1 implementation token:
  `GO_B5A1_AUTHORITY_INVENTORY_IMPLEMENTATION`.
- Maximum remediation rounds: 2.
- Target: fixed local repository input and pure synthetic tests only.

## Gate state

- Overall B5A: `READY`.
- B5A1: `ALLOWED`.
- B5A2: `BLOCKED`.
- B5A3: `BLOCKED`.
- B5A4: `BLOCKED`.
- B5A5: `BLOCKED`.
- B5A6: `BLOCKED`.
- B5A7: `BLOCKED`.
- B5A8: `BLOCKED`.

No later child inherits implementation authority from this gate.

## Allowed artifacts

B5A1 may add or update only:

- this work item and its execution/lifecycle evidence;
- a closed data manifest and its schema or TypeScript types under
  `docs/security/agency-authority/`;
- fixed-input offline verification tooling under `scripts/`;
- tests and synthetic fixtures under `tests/authority-inventory/`;
- package scripts only when they invoke the fixed-input verifier without adding
  a dependency; and
- bounded, non-sensitive evidence under `docs/evidence/`.

No file under production `src/`, `prisma/`, `public/`, provider configuration,
environment configuration, or deployment configuration may change.

## Baseline discovery contract

The verifier must discover and reconcile, at minimum:

- all callable exports in every `use server` module, including the 40 exports
  currently in `src/lib/queries.ts`;
- all server-action files, currently four;
- all API route files and exported HTTP handlers, currently five route files;
- all 23 TypeScript/TSX database-client imports under `src`: 22 direct `db.*`
  consumers and the `prisma-webhook-processing-store.ts` adapter injection;
- all UploadThing routers and upload-completion callbacks;
- every public route, public loader, domain resolver, public lead intake, and
  public visit mutation;
- every authenticated page/layout loader and page-level database write;
- every provider callback or external provider invocation;
- every internal-only function called across an authority or persistence
  boundary; and
- every accepted service/action surface that must remain regression-stable.

Discovery is repository-relative, path-normalized, and deterministically
ordered. It must not depend on the current directory outside the repository,
environment variables, generated output, build caches, Git network state, a
database, provider credentials, or runtime imports of application modules.

## Closed manifest record

Every discovered surface has exactly one manifest record with:

| Field | Closed requirement |
| --- | --- |
| `surfaceId` | Stable unique identifier derived from repository path and symbol. |
| `domain` | One value from the domain taxonomy. |
| `path` | Normalized repository-relative source path. |
| `symbol` | Exact exported handler, loader, callback, or internal function. |
| `invocation` | One value from the invocation taxonomy. |
| `effects` | Non-empty finite set from the effect taxonomy. |
| `actorSource` | Provider subject, anonymous-public contract, internal-derived actor, or blocked. |
| `requestedIds` | Complete deterministically ordered set of caller/route/provider-controlled selectors. |
| `action` | Exact finite policy action, `PUBLIC_BOUNDED`, `INTERNAL_ONLY`, or `UNDEFINED_BLOCKED`. |
| `ownershipPath` | Complete ordered Agency → SubAccount → resource chain, or an explicit non-tenant reason. |
| `persistencePredicate` | Required conjunctive keys, expected state, and cardinality. |
| `denial` | Finite non-enumerating denial and zero-side-effect rule. |
| `concurrency` | Expected-state, conditional count, order, uniqueness, or idempotency rule. |
| `publicBoundary` | `PRIVATE`, bounded public purpose, or blocked public review. |
| `disposition` | Exactly one closed disposition from the disposition taxonomy. |
| `sourceHash` | Git blob or canonical content hash for drift detection. |

Empty, unknown, free-form, duplicate, or extra fields fail validation. A
surface cannot be authorized merely because a parent layout, UI filter, route
shape, provider metadata, email address, or caller Boolean suggests access.

## Finite taxonomies

The manifest schema must close and validate these taxonomies:

- domain: identity/account, agency, subaccount, team/permission/invitation,
  billing/commerce/webhook, contact, notification/activity, upload/media,
  funnel/page/editor, pipeline/lane/tag, ticket/relations, automation,
  routing/public, and internal persistence;
- invocation: server action, API handler, page loader, layout loader, public
  loader, upload router/callback, provider callback, or internal-only;
- effect: read, create, update, delete, reorder, external call, upload grant,
  notification, revalidation, log, or composite;
- denial: unauthenticated, unauthorized, not found, conflict/stale, invalid
  input, dormant blocked, public unavailable, or internal invariant failure;
  and
- disposition: `ACCEPTED_RETAIN`, `B5A2`, `B5A3`, `B5A4`, `B5A5`, `B5A6`,
  `B5A7`, `B5A8`, `DORMANT_BLOCKED`, or `PUBLIC_REVIEW_REQUIRED`.

No record may use B5A1 as a remediation disposition because B5A1 changes no
production authority behavior.

## Ownership and confused-deputy fixtures

Pure fixtures must exercise at least:

- same-agency/same-subaccount success;
- same agency but different subaccount;
- cross-agency resource substitution;
- valid leaf with the wrong parent URL;
- page with the wrong funnel, lane with the wrong pipeline, and ticket with a
  foreign lane, contact, assignee, or tag;
- media with a mismatched upload purpose or subaccount;
- notification with mismatched actor, agency, or subaccount;
- missing, deleted, orphaned, duplicate, conflicting, and revoked ownership;
- one foreign, duplicate, missing, or malformed member in a reorder batch;
- stale expected state and conditional affected-count mismatch; and
- anonymous access to private surfaces and draft/unpublished public content.

Fixtures assert complete ordered ownership paths and zero unauthorized side
effects. They contain no representative customer, employee, or provider data.

## Drift and closure tests

Tests must fail on:

1. a discovered surface absent from the manifest;
2. a manifest surface absent from source;
3. duplicate path/symbol or `surfaceId` entries;
4. a new, removed, renamed, or hash-drifted authority-bearing surface;
5. a database import, adapter injection, server export, API handler, upload
   callback, public loader, direct page write, or provider call not classified;
6. an unrecognized taxonomy value or open-ended string;
7. an incomplete requested-ID or ownership path;
8. an invalid or multi-child disposition; or
9. a protected accepted surface whose exact source hash drifted.

Synthetic test copies may be mutated in a temporary directory to prove that
missing, duplicate, newly added, and drifted surfaces are detected. The tool
may not modify the worktree.

## Fixed-input tooling and evidence

The primary verification command must take zero arguments and use no
configuration beyond versioned repository files. It must emit only stable,
bounded counts, pass/fail identifiers, and a canonical manifest/evidence hash.
It must never emit file contents, source lines, identifiers from runtime data,
environment values, secrets, payloads, or stack traces.

Evidence records:

- exact candidate and parent SHAs;
- counts by invocation, domain, effect, and disposition;
- the 23-import split and current export/route/file counts;
- protected-surface hashes;
- focused and full verification commands with exit status;
- canonical manifest and evidence hashes; and
- explicit statements that no network, database, credential, provider,
  environment, deployment, or production-source access occurred.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| B5A1-01 | Discovery reconciles every required category and all 23 database imports without omission or duplication. |
| B5A1-02 | Every surface has exactly one schema-valid record and one closed disposition. |
| B5A1-03 | Requested identifiers, immutable actor source, action, ownership path, persistence predicate, denial, concurrency, and public boundary are explicit. |
| B5A1-04 | Source-discovery tests reject missing, duplicate, newly added, removed, renamed, and drifted surfaces. |
| B5A1-05 | Pure synthetic fixtures reject cross-agency, cross-subaccount, nested-parent, duplicate, stale, batch, and confused-deputy substitutions. |
| B5A1-06 | Accepted identity, team, contacts, billing, commerce, webhook, worker, database-proof, routing, and dependency surfaces are hash-protected. |
| B5A1-07 | Tooling is fixed-input, zero-argument, deterministic, bounded, offline, and incapable of importing application runtime modules. |
| B5A1-08 | Production `src`, Prisma, packages/dependencies, routes, middleware, providers, public assets, and deployment files are byte-unchanged. |
| B5A1-09 | Focused tests, full tests, lint, typecheck, build, frozen dependency continuity, diff-check, and secret/PII/log scans pass at the exact candidate SHA. |
| B5A1-10 | Architect and Verifier approve the same immutable candidate, execution seal, and lifecycle seal before Acceptance opens B5A2. |

## Forbidden work

B5A1 authorizes no agency-authority behavior change, re-theme, CRM/Odoo or
Composio work, schema/permission migration, dependency update, credential or
password-manager access, representative database, provider/network call,
public-route change, webhook publication, deployment, release, or external
action. It may not weaken or close a hold.

## Preserved holds

- Dependency audit: `STALE_UNREVALIDATED`.
- Advisories: `UNKNOWN`.
- `CF-P1-AUDIT-FRESH-01`: open hard gate.
- Permission `userId` migration: `DESIGN_REQUIRED`.
- Representative database and provider evidence: blocked.
- Public-runtime, local application, shared development, staging, pilot, and
  production readiness: `FAIL`.
- Re-theme/taste validation: blocked for its later dedicated checkpoint.
- CRM/Odoo introduction: blocked until agency and visual checkpoints close.

## Rollback

Rollback removes only B5A1 documentation, tests, offline tooling, manifests,
and evidence. It requires no runtime, database, provider, schema, package,
public-route, or deployment rollback.

## Status

`READY`

## Execution gate

`ALLOWED_FOR_B5A1_ONLY`

