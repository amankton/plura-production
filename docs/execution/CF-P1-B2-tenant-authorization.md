# CF-P1-B2 — Tenant Authorization Foundation

Status: implemented; pending independent verification
Branch: `codex/crewframe-foundation`
Parent checkpoint: `02e225c`
Date: 2026-09-03

## Objective

Establish the first provider-neutral, server-derived tenant authorization path
before upgrading Clerk or enabling Odoo, Composio, or agent writes. Apply the
path to one complete contact slice and characterize the existing middleware
routing behavior with isolated tests.

This batch does not make the application deployable.

## Trust Model

- The identity adapter emits only an immutable provider subject. Clerk roles,
  metadata, email addresses, tokens, and full user objects do not enter policy
  code.
- The provider subject must exactly match `User.id`. There is no fallback to
  email or private metadata. A missing local user produces an explicit
  provisioning-required denial.
- Agency and subaccount ownership are loaded on the server. A route, form, or
  browser-supplied identifier selects the requested resource; it never proves
  access.
- Agency owners and admins may access only subaccounts in their own agency.
- Subaccount users and guests require exactly one active permission for the
  requested subaccount. Missing, revoked, duplicate, conflicting, cross-agency,
  or orphaned permission state fails closed.
- `TenantContext` is request and resource scoped and includes the local actor,
  provider subject, role, agency, authorized subaccount scope, selected
  subaccount, and correlation ID.

## Contact Policy

| Role | List | Search | Create | Update |
| --- | --- | --- | --- | --- |
| Agency owner | Allow | Allow | Allow | Allow |
| Agency admin | Allow | Allow | Allow | Allow |
| Subaccount user with active permission | Allow | Allow | Allow | Allow |
| Subaccount guest with active permission | Allow | Allow | Deny | Deny |

Guest reads currently include contact names, email addresses, and the
ticket-derived values displayed on the contacts page. This is an explicit
read-only product decision for the existing role, not a reusable global guest
rule. A later permission redesign may split PII and financial visibility.

Authenticated contact create and update are separate narrow commands. Create
does not accept an ID, and the server supplies the authorized subaccount ID.
Update accepts only contact ID, name, and email and uses both contact ID and
authorized subaccount ID in its persistence predicate. List is capped at 250
records and search at 25 records with bounded input.

## Public Lead Intake

The public funnel path no longer shares the authenticated contact command. It
submits a funnel ID, name, and email to a separate command. The server resolves
the owning subaccount only from a published funnel; an unpublished, unknown,
or browser-selected subaccount is rejected before a write.

Production-grade consent capture, abuse protection, durable rate limiting, and
public custom-domain authentication behavior are not completed in this batch.
Public lead intake remains a deployment blocker until those controls and their
journey tests exist.

## UploadThing Boundary

UploadThing middleware now rejects a missing Clerk `userId` and returns only
that immutable ID as upload metadata. This fixes the previous truthy-auth-object
bug.

This is authentication only. The agency-logo, subaccount-logo, avatar, and
media endpoints still lack resource-specific tenant input and policy checks.
They remain blocked for production use until tenant binding, ownership checks,
and endpoint-specific tests are added.

## Middleware Characterization

The Clerk wrapper delegates host and path decisions to a pure routing function.
Tests cover root and site rewrites, sign-in redirects, agency and subaccount
paths, query strings, recognized custom subdomains, unknown hosts, static
assets, and API/TRPC matcher paths. Host and root-domain values are normalized
for case and ports, and a custom tenant requires a dot-delimited domain suffix.
Unknown and suffix-confused hosts are no longer interpreted as tenants. The
test reads the exported middleware source to pin the static Next matcher while
the pure routing tests exercise runtime decisions.

## Data Preflight

No `.env` or database credentials are present in this checkout, so no local or
production tenant data was queried or mutated. Existing onboarding code writes
the Clerk subject to `User.id`, but historical data has not been proven to obey
that invariant. The resolver therefore fails closed when no exact `User.id`
match exists.

The legacy `Permissions` model remains keyed by email, lacks a user/subaccount
unique constraint, and runs with Prisma-managed relations. A later migration
must key permissions by immutable user ID, add compound uniqueness, repair
orphaned data, and restore database-enforced referential integrity.

## Verification Contract

Run from the repository root:

```powershell
bun install --frozen-lockfile
bun run verify
bun audit
git diff --check
```

Current implementation evidence:

- ESLint: no warnings or errors.
- TypeScript: pass.
- Bun tests: 51 passing across identity, tenant resolution, policy, contact
  service/query scope, public lead intake, upload authentication, and routing.
- Credential-free production build: pass.
- Bun audit: 72 findings — 1 critical, 37 high, 28 moderate, and 6 low.

The audit findings, public-intake controls, UploadThing tenant authorization,
legacy permission schema, and unprotected non-contact operations remain hard
deployment blockers.

## Rollback

Revert this batch as one commit on top of `02e225c`. It has no Prisma schema or
external-system migration and requires no data rollback.

## Next Batch

After independent verification, upgrade Clerk 4 to Clerk 6 while retaining
Next 14 and React 18. Migrate to the supported asynchronous authentication and
middleware APIs without combining the change with Next 15 or React 19.
