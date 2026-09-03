# CF-P1-B1 — Dependency and Build Stabilization

Status: independently verified as a non-deployable rollback checkpoint
Branch: `codex/crewframe-foundation`
Starting commit: `aff4ccd265cd43f7576ab9c8033821c01bcf71a8`
Date: 2026-09-03

## Objective

Create a reproducible rollback point on the existing Next 14, React 18, and
Clerk 4 architecture before resource authorization and major-version
migrations begin.

This is a stabilization checkpoint, not a production-readiness claim.

## Scope

- Regenerate the legacy Bun lockfile with Bun 1.3.11 and prove a frozen install.
- Apply the latest compatible dependency versions and selected latest releases
  within the current framework/authentication generation.
- Move Next.js from 14.0.4 to 14.2.35 and keep `eslint-config-next` aligned.
- Move Clerk to the final 4.x release and Prisma to the final 5.x release.
- Update the existing Radix, Tailwind, React 18, form, table, and supporting
  dependency ranges without opting into Next 15, React 19, or Clerk 6/7.
- Upgrade `uuid` to 11.1.1 and remove the obsolete external type package.
- Prevent the public `/site` route from calling Stripe during the production
  build. Keep paid pricing request-rendered and show an explicit status when
  billing is not configured.
- Repair compatibility errors exposed by current TypeScript and `date-fns`.
- Upgrade `next-themes` to 0.4.6 and use its public type export, removing the
  stale secondary Next 14.0.4 resolution from the dependency graph.
- Clear all 15 pre-existing exhaustive-dependency warnings across 14 client
  components. Stabilize modal actions and remove stale effect closures instead
  of suppressing the lint rule.
- Add pinned package-manager metadata and repeatable `typecheck` and `verify`
  scripts.

## Explicit Non-Scope

- Tenant authorization behavior
- Next, React, or Clerk major upgrades
- Database/schema migrations
- Odoo, Composio, or agent integration
- Crewframe re-theme work

## Security Disposition

The pre-change audit reported 86 advisories: 2 critical, 43 high, 33 moderate,
and 8 low. After this batch, the raw Bun total is 72: 1 critical, 37 high, 28
moderate, and 6 low. The direct `uuid` advisory was removed, and upgrading
`next-themes` removed its stale Next 14.0.4 peer resolution.

The remaining total is not accepted risk and is not used as a release signal.
It includes legacy framework/authentication dependencies and development or
transitive tooling. The next batches must record reachability and remediation
per finding. In particular, the supported Clerk and Next migrations remain
required before any internet-facing or production-data deployment.

No Odoo write, agent write, external send, public launch, or production-data
authorization is granted by this checkpoint.

The remaining release blockers include the Clerk 4 `form-data` critical,
framework advisories affecting Next 14, and transitive runtime or build-tool
findings. They cannot all be removed without crossing the deliberately staged
Clerk, Next, and React major-version boundaries. This checkpoint may be used as
a source-control rollback point, but it must remain non-deployable.

The first independent verification rejected the batch because it still had 15
React hook warnings, the stale Next 14.0.4 resolution, and incomplete blocker
documentation. Those implementation and documentation findings have been
remediated; the raw audit findings above remain an explicit release block.

## Behavior Change

`/site` is now dynamically rendered. When both the Stripe secret and platform
product ID are configured, it requests active paid prices at request time.
When either is absent, it renders the free tier and an explicit billing-
configuration status instead of failing the build or issuing an unauthenticated
Stripe request.

## Verification Contract

Run from the repository root:

```powershell
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run build
bun audit
```

Expected at this checkpoint:

- Frozen install succeeds without modifying `bun.lockb`.
- Lint exits successfully with no warnings or errors.
- TypeScript exits successfully.
- Production build succeeds without Stripe credentials or external Stripe
  requests.
- Audit remains release-blocking until the planned major migrations and
  finding dispositions are complete.

## Rollback

Revert this checkpoint as one commit. No database or external-system rollback
is required because the batch changes only source, dependency metadata, and the
generated lockfile.

## Next Batch

`CF-P1-B2` establishes a provider-neutral asynchronous identity adapter,
server-derived `TenantContext`, resource policy functions, an isolated test
harness, and one protected subaccount contacts slice. It must not depend on
mutable email, client-supplied user data, or Clerk private metadata as an
authorization source.
