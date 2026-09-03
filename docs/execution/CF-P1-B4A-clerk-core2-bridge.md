# CF-P1-B4A — Clerk Core 2 Bridge

Status: implemented; pending independent verification
Branch: `codex/crewframe-foundation`
Parent checkpoint: `a63148f6b9ff584c94c871d7ef934448fbd2c0bf`
Implementation commit: pending
Verified candidate: pending
Date: 2026-09-03

## Objective

Move the identity boundary from Clerk 4 to the maintained Clerk 6/Core 2 line
without combining the change with the Next.js, React, Prisma, UploadThing,
Stripe, design-system, Odoo, or agent-platform migrations.

## Scope and implemented guarantees

- `@clerk/nextjs` is pinned to `6.39.6` and `@clerk/themes` to `2.4.63`.
  Every other direct dependency remains at the B3 version.
- Middleware uses Clerk's server-only `clerkMiddleware` API. It invokes
  `auth.protect()` before routing any path outside an exact public allowlist.
- The only public paths are `/site` and `/api/uploadthing`; prefix-like and
  unknown paths remain protected.
- Server helpers import `auth`, `currentUser`, and `clerkClient` only from
  `@clerk/nextjs/server`, and async Clerk 6 APIs are awaited.
- Provider adapters expose only the immutable Clerk subject to Crewframe's
  identity boundary. Profile provisioning requires an exact, verified primary
  email; it does not accept a fallback address.
- Invitation delivery carries only the non-authoritative
  `throughInvitation: true` marker. Clerk metadata carries no role or agency
  authorization input.
- A missing invitation redirect URL fails closed before a Clerk client or
  provider mutation is requested.
- Sign-out routing is configured once at each `ClerkProvider` boundary rather
  than on individual user-button instances.
- Structural tests freeze the dependency leaf, server-only imports, public
  route allowlist, and the absence of provider-role authority.

## Version and security evidence

- Official Clerk migration references:
  - <https://clerk.com/docs/guides/development/upgrading/upgrade-guides/nextjs-v6>
  - <https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3>
  - <https://clerk.com/docs/reference/nextjs/clerk-middleware>
- `bun install --frozen-lockfile`: passed; 908 installs across 707 packages,
  no changes.
- `bun pm why` finds no `@clerk/clerk-sdk-node`, `form-data`, or `cookie` in
  the lockfile. Clerk resolves `js-cookie` to `3.0.7`.
- `bun audit` improved from 72 advisories to 68:
  - critical: 1 to 0
  - high: 37 to 35
  - moderate: 28 to 28
  - low: 6 to 5
- The removed findings are the obsolete Clerk-chain `form-data`, `js-cookie`,
  and `cookie` advisories. Remaining Next.js and transitive findings are
  intentionally assigned to later dependency leaves.

## Verification

- Agency architect: `GO_B4A`; no remaining checkpoint code blocker.
- Independent verifier: pending exact-commit review.
- `bun run verify`: passed.
  - ESLint: zero warnings or errors.
  - TypeScript: passed.
  - Bun: 104 tests, 490 expectations, zero failures.
  - Next.js 14.2.35 production build: passed, including static generation and
    build traces.
- Focused Clerk adapter, upgrade-surface, and middleware tests: 17 passed, 50
  expectations, zero failures.
- `git diff --check`: passed; line-ending notices only.
- `prisma/schema.prisma`: unchanged from B3.

## Explicit exclusions and blockers

- No real Clerk tenant, production database, or staging database was accessed.
- Credentialed sign-up, sign-in, sign-out, invitation, revocation, and team-flow
  smoke tests remain mandatory before deployment.
- Next.js remains at `14.2.35`; its current security advisories remain a
  deployment blocker for the isolated framework upgrade leaf.
- The 68 remaining dependency advisories and all B3 production blockers remain
  open. This is a non-deployable checkpoint.
- No Prisma schema/data migration, Odoo or Composio integration, agent runtime,
  product feature, copy, layout, token, font, color, or other design change is
  included.

## Rollback

Revert the B4A implementation commit to return to
`a63148f6b9ff584c94c871d7ef934448fbd2c0bf`. This checkpoint has no database or
provider-data migration to reverse; its automated coverage uses injected
provider fakes.
