# CF-P1-B5A1 — Closed agency authority inventory

## Checkpoint

- Immutable parent: `c6e989f8fb62bd99f28a2c537c57f4d85d069c72`.
- Accepted candidate: `a7d9329279d7fe865633e874fb61acfb992be41a`.
- Architect approval: `APPROVE_B5A1_CANDIDATE`.
- Independent verification: `PASS_B5A1_CANDIDATE`.
- Acceptance seal clearance: `GO_B5A1_CANDIDATE_SEAL`.
- Remediation rounds used: 1 of 2.
- Branch: `codex/crewframe-foundation`.

## Outcome

B5A1 adds a deterministic, repository-only authority inventory for the agency
platform. It reconciles the versioned server actions, API handlers, database
composition, page and layout loaders, upload boundaries, external-provider
operations, public surfaces, and internal authority boundaries without
changing application runtime behavior.

The inventory contains 230 unique records. Its executable verifier is fixed
input and accepts zero arguments. The versioned manifest is closed by a JSON
schema and an independent record-count and whole-manifest hash lock. Provider
discovery uses TypeScript syntax bindings for value imports, aliases, returned
clients, and explicitly reviewed injected contracts; type-only and unrelated
local calls do not create provider records.

## Inventory snapshot

- Database imports: 23 total, split into 22 direct callers and one adapter
  injection.
- Server-action exports: 53 across four server-action files.
- `src/lib/queries.ts` exports: 40.
- API routes: five files and six exported HTTP handlers.
- Page loaders: 24; layout loaders: seven.
- UploadThing boundaries: four routes and four completion callbacks.
- Provider-operation boundaries: 33.
- Ownership fixtures: 30, including 28 denied cases with zero permitted side
  effects.
- Manifest lock:
  `sha256:26b9099ac90b8ec72015fd5396c56b2660d8f7a29b1708cac39ec222627ee039`.

Public lead records begin at a published funnel and bind Agency, SubAccount,
and Contact ownership before persistence. All four current upload completion
callbacks are recorded as no-op boundaries with no requested selectors and no
persistence. Dormant webhook provider lookups remain `DORMANT_BLOCKED`.

## Verification

- Zero-argument inventory verifier: pass, including repeated and outside-CWD
  execution.
- Focused authority-inventory suite: 8 passed, 0 failed, 131 expectations.
- Complete suite: 305 passed, 0 failed, 1,487 expectations across 42 files.
- `bun install --frozen-lockfile --ignore-scripts --offline`: pass; 895
  installs across 705 packages, no changes.
- Lint: pass, no warnings or errors.
- Typecheck: pass.
- Production build: pass, including 13 of 13 static pages.
- Scope, deterministic-manifest, manifest-lock, closed-schema, semantic-field
  mutation, alias/injection, source-drift, protected-surface, and
  secret/PII scans: pass.

Protected Git blobs are identical at the parent and candidate:

| Surface | Git blob |
| --- | --- |
| `package.json` | `c8a1a9d11f484792d9d2ffee9d5c728144841105` |
| `bun.lockb` | `9fd7455e517b55bd2cc77a882cc4468f0eebb526` |
| `prisma/schema.prisma` | `68cc70de4c0e3d3d18fa29c00869d256c3230700` |
| `src/middleware.ts` | `2d619a87849a6749937b3472702d0ae1455a8e99` |
| Stripe client composition | `df492ae973b2be48ae17a99eb5d0ecdd232adfcb` |
| Clerk identity composition | `8e633628afda4ee69c04f296b45300ceeb68682d` |
| UploadThing router | `b271e9686e01c33a5a03901eb9fa1af9f4801f92` |

## Scope and holds

The candidate changes exactly nine B5A1 documentation, manifest, schema,
offline-script, test, and synthetic-fixture files. It changes zero production
source, Prisma, package/lock, public, provider configuration, middleware, or
deployment files. Verification accessed no database, provider, credential,
representative data, network service, deployment, or public runtime.

The dependency audit remains `STALE_UNREVALIDATED`, advisories remain
`UNKNOWN`, `CF-P1-AUDIT-FRESH-01` remains open, and permission migration
remains `DESIGN_REQUIRED`. Local, shared-development, staging, pilot,
production, and public-runtime readiness remain `FAIL`. B5A2 through B5A8,
re-theme/taste validation, and CRM/Odoo introduction remain blocked pending
their own accepted gates.

## Seal boundary

This record seals evidence for candidate
`a7d9329279d7fe865633e874fb61acfb992be41a` only. It grants no authority to
modify runtime behavior, access a provider or database, publish a route,
deploy, change readiness, or begin B5A2. B5A1 becomes historical only after a
separate issue-only lifecycle seal is independently verified and accepted.
