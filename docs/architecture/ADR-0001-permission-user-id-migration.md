# ADR-0001: Migrate permissions from email ownership to immutable user IDs

Status: proposed; no schema or data changes are authorized by this record

## Context

`Permissions.email` currently points to `User.email`. Email is mutable identity
data and the schema does not enforce one permission per user/subaccount pair.
Crewframe authorization now fails closed on duplicate, conflicting, orphaned,
and cross-agency rows, but concurrent grants cannot be production-safe until the
database owns this invariant.

## Decision

Use an expand-and-contract migration. No destructive step may run until the
preceding stage is measured against an authorized staging copy and its rollback
has been exercised.

1. Add nullable `Permissions.userId`, its index, and a relation to `User.id`.
   Keep the email relation and all current reads intact.
2. Dual-write `email` and `userId` for new permission changes. Alert on any row
   where the two identifiers resolve to different users.
3. Run the read-only preflight, resolve unmatched emails, duplicates,
   conflicting access values, orphaned subaccounts, cross-agency rows, and
   missing provider-subject mappings. Backfill only verified rows.
4. Add the compound unique constraint on `(userId, subAccountId)` after the
   preflight reports zero blocking anomalies. Keep `userId` nullable during the
   first constraint deployment if the database requires an online transition.
5. Cut reads to `userId`, compare authorization decisions against shadow email
   reads, then make `userId` required after the comparison window is clean.
6. Stop writing email, remove its relation/index, and finally remove the email
   column in a later release.
7. Restore database foreign keys after the deployed data and delete semantics
   have been validated; do not rely indefinitely on Prisma relation emulation.

## Safety gates

- Production data, Clerk exports, and database credentials require explicit
  authorization and are not part of CF-P1-B3.
- Owner transfer and last-owner behavior require a separate product decision.
- A duplicate group is never repaired by selecting an arbitrary winner.
- Every stage needs a forward migration, rollback or compensating procedure,
  row-count reconciliation, and authorization regression tests.
- The current schema remains unchanged until a representative staging preflight
  and migration rehearsal are approved.

## Read-only preflight

Run `bun scripts/permission-migration-preflight.ts` only against an authorized
database. The JSON output uses record references and never includes stored email
addresses. Provider mapping coverage is deliberately reported as unevaluated
unless an authorized provider-subject set is supplied to the analyzer.
