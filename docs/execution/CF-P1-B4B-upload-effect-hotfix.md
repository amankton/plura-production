# CF-P1-B4B — Upload Runtime Effect Hotfix

Status: verified; accepted as a non-deployable checkpoint
Branch: `codex/crewframe-foundation`
Parent checkpoint: `2affdfdd119dcf3c8d3bef6af9d8826079567fc4`
Implementation commit: `f701c75a93775690917107778c811dd4a32c9579`
Verified candidate: `f701c75a93775690917107778c811dd4a32c9579`
Date: 2026-09-03

## Objective

Remove the vulnerable Effect runtime resolved by UploadThing without combining
the security fix with UploadThing's credential and API migration or with any
other dependency family.

## Decision

UploadThing 7 was evaluated and deliberately deferred. The latest stable pair,
`uploadthing@7.7.4` and `@uploadthing/react@7.3.3`, supports the current Next.js
and React versions, but `uploadthing@7.7.4` pins vulnerable `effect@3.17.7`.
Moving to v7 therefore would not clear the target advisory and would also
require the V7 token and breaking handler/component API migrations.

This checkpoint instead uses a package-manager override to resolve
`effect@3.22.1`. UploadThing's related schema peer range accepts that version.
The override is a temporary, documented security bridge until UploadThing
ships a stable dependency graph with Effect 3.20.0 or newer.

## Scope and implemented guarantees

- `uploadthing` remains exactly `6.13.3` and `@uploadthing/react` remains
  exactly `6.8.0`.
- `package.json` overrides Effect to exactly `3.22.1`; the lockfile resolves no
  Effect version below 3.20.0.
- No UploadThing route, handler, component, environment-variable contract, or
  product UI changed.
- All four file routes retain authentication middleware backed by the
  server-derived Clerk identity adapter.
- Upload metadata contains only the immutable provider subject as `userId`;
  no browser-supplied user ID, email, header, or provider role is trusted.
- `/api/uploadthing` remains the single exact public upload transport path;
  sibling and prefix-like paths remain protected.
- A structural regression test freezes the dependency families and upload
  authentication surface.

## Version and security evidence

- Effect advisory: <https://github.com/advisories/GHSA-38f7-945m-qr2g>
- UploadThing v7 migration reference: <https://docs.uploadthing.com/v7>
- `bun pm why effect` resolves all UploadThing paths to `effect@3.22.1`.
- `bun audit` improved from 68 advisories to 67:
  - critical: 0 to 0
  - high: 35 to 34
  - moderate: 28 to 28
  - low: 5 to 5
- `GHSA-38f7-945m-qr2g` is absent from the resulting audit.

## Verification

- Agency architect: `GO_B4B`; no remaining checkpoint code blocker.
- Independent verifier: PASS against
  `f701c75a93775690917107778c811dd4a32c9579`; production readiness remains FAIL
  by design.
- `bun install --frozen-lockfile`: passed; 909 installs across 708 packages,
  no changes.
- `bun run verify`: passed.
  - ESLint: zero warnings or errors.
  - TypeScript: passed.
  - Bun: 106 tests, 505 expectations, zero failures.
  - Next.js 14.2.35 production build: passed, including static generation and
    build traces.
- Focused upload authentication, security-surface, and middleware tests: 16
  passed, 44 expectations, zero failures.
- `git diff --check`: passed; line-ending notices only.
- `prisma/schema.prisma`: unchanged from the parent checkpoint.

## Explicit exclusions and blockers

- No credentialed upload was performed against an UploadThing account.
- Resource-specific agency/subaccount authorization and upload persistence
  remain pre-deployment work beyond this dependency-only hotfix.
- The override advances an exact transitive dependency beyond UploadThing 6's
  own pin. Automated compatibility gates pass, but authenticated upload smoke
  testing remains mandatory before deployment.
- The remaining 67 advisories, current Next.js findings, and all inherited
  B3/B4A production blockers remain open. This is a non-deployable checkpoint.
- No direct dependency, application source, Prisma schema/data, Odoo or
  Composio integration, agent runtime, design token, font, color, copy, or
  layout changed.

## Rollback

Revert the B4B implementation commit to return to
`2affdfdd119dcf3c8d3bef6af9d8826079567fc4`. This checkpoint has no source,
schema, data, environment-variable, or external credential migration to
reverse.
