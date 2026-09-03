# CF-P1-B3 — Team Authority-Root Lockdown and Migration Readiness

Status: implemented; pending independent verification
Branch: `codex/crewframe-foundation`
Parent checkpoint: `5ddf6b6989aae8e4d7573de2d028e1a72c4b50c5`
Date: 2026-09-03

## Objective

Replace Plura's generic user, invitation, role, and permission server actions
with fail-closed Crewframe boundaries. This checkpoint intentionally changes no
dependency version, lockfile, Prisma schema, or production data.

## Implemented guarantees

- Provider subject maps exactly to local `User.id`; email and Clerk role
  metadata are not authorization inputs.
- Agency and subaccount layouts authorize against database-backed agency or
  tenant contexts.
- Team roster, member reads, invitations, role changes, member removal, and
  permission administration require a same-agency `AGENCY_OWNER`.
- `AGENCY_ADMIN`, `SUBACCOUNT_USER`, and `SUBACCOUNT_GUEST` can update only
  their own bounded name and avatar fields.
- Owner invitation, owner promotion/demotion, owner removal, and self-removal
  are denied.
- Permission grant/revoke accepts member and subaccount selectors only. Email,
  permission ID, and access state are resolved or fixed on the server.
- Duplicate, conflicting, orphaned, and cross-agency permission state fails
  closed. Admin-boundary role changes revoke existing grants atomically.
- Member deletion and role changes are conditional on member ID, agency, and
  expected role. Permission updates are conditional on permission ID, target
  email, subaccount, and expected prior access; affected-row counts must equal
  one. Role changes revalidate the permission snapshot inside a serializable
  transaction before any role write.
- Invitation agency and role come only from the persisted invitation.
  Provider metadata carries no role or agency authority.
- Provider invitation failure produces no database write. A database failure
  after provider delivery triggers provider revocation; compensation failure
  raises an explicit reconciliation error.
- Agency onboarding can connect only the authenticated local actor by ID, never
  the submitted company email.
- The old generic functions were removed from `src/lib/queries.ts`; a structural
  regression test prevents them and provider-role gates from returning.

## Migration readiness

- `scripts/permission-migration-preflight.ts` is read-only and reports record
  references without stored email addresses.
- Synthetic tests cover unmatched users/subaccounts, duplicate and conflicting
  rows, cross-agency rows, orphaned users, and optional provider mappings.
- `docs/architecture/ADR-0001-permission-user-id-migration.md` defines the
  additive user-ID, dual-write, verified backfill, compound-unique, read
  cutover, email contraction, and foreign-key restoration sequence.
- No real database or Clerk export was accessed. Provider mapping coverage is
  deliberately unevaluated until an authorized staging dataset is supplied.

## Verification

- `bun install --frozen-lockfile`: passed; 713 installs across 666 packages,
  no changes.
- `bun run verify`: passed.
  - ESLint: zero warnings or errors.
  - TypeScript: passed.
  - Bun: 97 tests, 454 expectations, zero failures.
  - Next.js production build: passed, including page generation and traces.
- `git diff --check`: passed; line-ending notices only.
- `git diff -- package.json bun.lockb prisma/schema.prisma`: empty.
- `bun audit`: 72 advisories — 1 critical, 37 high, 28 moderate, 6 low.

## Explicit exclusions and blockers

- No production or staging database writes, Clerk invitations, or member
  deletion were performed.
- The email-keyed permission schema still lacks compound uniqueness and a
  user-ID foreign key; concurrent grants remain unsafe for production.
- Member deletion cascade behavior needs representative staging evidence.
- Owner transfer and last-owner semantics require a separate product decision.
- Broad legacy actions outside team/account authority—including other agency,
  subaccount, billing, OAuth, notification, webhook, and public-intake
  surfaces—remain deployment blockers.
- The 72 dependency advisories, including the Clerk-chain critical finding and
  current Next.js findings, remain deployment blockers for the next upgrade
  checkpoints.

## Rollback

Revert the B3 implementation commit to return to
`5ddf6b6989aae8e4d7573de2d028e1a72c4b50c5`. This checkpoint has no schema or
data migration to reverse and its automated verification uses only injected
stores and provider fakes.
