# CF-P1-B5A — Agency authority closure intake

## Problem

Crewframe now has tested identity, agency, tenant, team, contact, billing,
commerce, webhook-intake, local-worker, and synthetic database-proof
foundations. The remaining agency control plane is not uniformly routed through
those foundations. Repository snapshot
`2522f4131311e8a1b405c591593017e9af775b63` still exposes a broad legacy
server-action module, direct database reads and writes in pages, and nested
resource operations that accept identifiers without proving the full parent
chain in the persistence predicate.

This intake does not claim that a layout-level context check automatically
authorizes a child server action. Every callable boundary and direct query must
be inventoried independently before the agency portion can be declared closed
or the CRM/Odoo introduction contract can begin.

## Goal

Define the complete, testable authority-closure program for the Crewframe
agency control plane. The program must map every server action, API route,
handler, loader, provider callback, and direct database query to:

- immutable actor identity;
- caller-supplied agency, subaccount, and nested-resource identifiers;
- required role and named action;
- the complete ownership path and conjunctive persistence predicate;
- public/private classification and side-effect boundary;
- non-enumerating denial behavior;
- concurrency, stale-state, and deletion behavior; and
- a bounded implementation child or an explicitly retained accepted surface.

The result must let Architect, Verifier, and Acceptance prove when the agency
control plane is closed without relying on UI reachability, parent layouts,
provider metadata, email identity, or caller assertions.

## Authority and immutable parent

- Accepted parent and P-02 lifecycle seal:
  `2522f4131311e8a1b405c591593017e9af775b63`.
- P-02 final acceptance token:
  `ACCEPT_B4F2B_P02_LIFECYCLE_AND_PUSH`.
- B5A intake token:
  `GO_B5A_AGENCY_AUTHORITY_CLOSURE_INTAKE`.
- Branch: `codex/crewframe-foundation`.
- Maximum B5A remediation rounds: 2.
- Target environment: local repository inspection and synthetic tests only.

## Repository snapshot

The following are code findings at the immutable parent, not runtime or
representative-database findings:

- `src/lib/queries.ts` is a `use server` module with 40 exported callables.
  Some delegate to accepted services, but media, notifications, funnels/pages,
  and pipeline hierarchy operations still contain direct unscoped access.
- Twenty-two TypeScript/TSX files import the database client directly,
  including authenticated pages, public funnel pages, service adapters, and
  the legacy action module.
- Four server-action files and five API route files form the currently visible
  callable transport surface.
- Agency and tenant contexts bind the Clerk provider subject to a provisioned
  local actor. Tenant context verifies agency containment and requires exactly
  one active, same-agency permission for non-privileged actors.
- The accepted team, contact, billing, and commerce services already place
  meaningful policy and ownership checks behind their transports. B5A must
  preserve and regression-test these boundaries rather than rewrite them by
  default.
- `getAuthUserDetails`, the Sidebar client boundary, subaccount settings, and
  `getSubAccountTeamMembers` expose broader Agency, User, Permission, or
  SubAccount records than the resolved actor needs. A filtered UI is not a
  safe serialized projection.
- Agency and subaccount dashboards call Stripe directly with stored connected
  account identifiers. These reads must remain frozen and inventoried until a
  separately accepted provider-binding checkpoint; B5A cannot expand them.
- `Permissions` still relates a user through mutable email and has no
  `userId`. Its migration remains `DESIGN_REQUIRED`; B5A cannot invent or apply
  permission DDL.
- Prisma uses `relationMode = "prisma"`, so application-layer predicates and
  transactional validation are the effective nested-integrity boundary.
- Automation, trigger, action, and automation-instance models exist, but no
  complete agency-authorized runtime surface is present. Absence of a route is
  not permission to introduce one.

Snapshot anchors:

| Surface | Parent Git blob |
| --- | --- |
| Prisma schema | `68cc70de4c0e3d3d18fa29c00869d256c3230700` |
| legacy query/action module | `8140bfb038619fcb8cc3ed0ecf8aa137b20f3639` |
| agency context | `153000075d8ee93a29298c27a0346871b68a8c8d` |
| tenant context | `1c3dcc02eac37042dbd571eb127ac26acfbb0d74` |
| tenant action policy | `57096411c662e7dca73ed1c3c39cedc1e8b9d8fe` |
| account actions | `f0a806c084d2207af9abb840e95762974bc37186` |
| team actions | `5f80e7a344181690c3f586feb0781be2077fb5e9` |
| commerce actions | `9d1f5d46746794d04aa58c3a15e0af3d15eb0a14` |
| UploadThing router | `b271e9686e01c33a5a03901eb9fa1af9f4801f92` |
| middleware | `2d619a87849a6749937b3472702d0ae1455a8e99` |

## Authority inventory contract

The first implementation child must produce a deterministic, closed inventory
record. Every entry requires all of these fields; unknown fields and free-form
authority claims are rejected:

| Field | Required meaning |
| --- | --- |
| `surfaceId` | Stable repository-local identifier. |
| `domain` | One finite domain from the matrix below. |
| `path` and `symbol` | Exact source file and exported/route/loader symbol. |
| `invocation` | Server action, API route, page/layout loader, public loader, callback, or internal-only function. |
| `effect` | Read, create, update, delete, reorder, external call, upload grant, or composite. |
| `actorSource` | Provider subject, public-anonymous contract, or blocked. |
| `requestedIds` | Every caller- or route-controlled selector. |
| `action` | Exact role-policy action; never a generic authenticated Boolean. |
| `ownershipPath` | Complete Agency → SubAccount → nested-resource chain. |
| `persistencePredicate` | Required conjunctive keys and expected prior state. |
| `denial` | Finite non-enumerating error/not-found behavior and zero-side-effect rule. |
| `concurrency` | Expected-state, count, ordering, uniqueness, or idempotency rule. |
| `publicBoundary` | Fixed public reason and bounded effect, or `PRIVATE`. |
| `disposition` | `ACCEPTED_RETAIN`, one B5A child ID, `DORMANT_BLOCKED`, or `PUBLIC_REVIEW_REQUIRED`. |

The inventory must be derived from fixed repository paths with deterministic
ordering. Tests must fail when a new `use server` export, API route, direct
database import, UploadThing route, public route, or page-level write is absent
from the inventory.

## Domain matrix

| Domain | Current authority observation | Required closure disposition |
| --- | --- | --- |
| Identity/account entry | Provider-subject provisioning and invitation claim are service-backed and tested. | Retain exact-subject, exact-invitation, compensation, and no-caller-role contracts; inventory every entry action. |
| Agency profile/lifecycle | Goal/delete/update have owner/operator checks, while page loaders and legacy notification calls are mixed into the same module. | Separate reads from destructive mutations; require exact agency context, role, expected state, and affected-row count. |
| Subaccount lifecycle/sidebar | Create/update/delete have partial context checks; `getAuthUserDetails`, Sidebar, and subaccount settings serialize broader agency/subaccount records than the actor needs. Nested defaults and caller-supplied IDs require explicit creation/collision contracts. | Bind every create/update/delete and generated child to the actor agency and exact subaccount state; replace broad ORM graphs with actor-safe projections. |
| Team/permissions/invitations | Accepted service owns current team actions and rejects duplicate/conflicting permissions, but `getSubAccountTeamMembers` accepts a selected subaccount and returns full User rows without resolving tenant context. | Preserve the accepted service boundary, replace the legacy team read with a strict projection, and keep email-to-`userId` migration blocked. |
| Billing/connected commerce/webhooks | Accepted services and private routes have separate verified gates. Agency/subaccount dashboards still call Stripe directly with stored connected-account identifiers. | Freeze provider selectors and existing webhook gates; inventory the direct loader calls as separately blocked provider-binding work without expanding B5A authority. |
| Contacts/public lead | Authenticated contact service is tenant-scoped; public lead derives ownership from a published funnel. | Retain with route/action coverage, bounded public-input rules, and nested ticket/contact relationship tests. |
| Notifications/activity | `saveActivityLogsNotification` accepts agency/subaccount/description data, includes an unauthenticated actor fallback, and `getNotificationAndUser` accepts an agency ID without its own context. | Replace with actor-derived agency/tenant services, bounded message events, conjunctive notification ownership, and no raw error logging. |
| Uploads/media | UploadThing proves only authenticated provider identity; media list/create/delete accept subaccount/media IDs without an end-to-end asset-ownership grant. | Bind upload intent, route slug, limits, completion, media persistence, and deletion to one exact actor/subaccount; prevent orphan and cross-tenant assets. |
| Funnels/pages/editor | Funnel upsert and commerce configuration are partly service-backed, but reads, page upsert/delete, editor loading, and nested route selectors do not consistently prove Funnel → SubAccount. Public domain reads and visit counting do not yet form an accepted public contract. | Close only authenticated authoring and editor authority in B5A. Inventory public domain lookup, visits, leads, middleware, and checkout as `PUBLIC_REVIEW_REQUIRED`; do not alter or publish them here. |
| Pipelines/lanes/tags | Legacy reads, upserts, deletes, and reorder batches accept pipeline/lane/tag IDs or unchecked Prisma inputs. Pipeline page loading can create a default pipeline from a route ID. | Introduce tenant-scoped pipeline/lane services; verify parent chains, batch homogeneity, ordering CAS, and exact affected counts. Ticket relationships are a separate child. |
| Tickets/contact/assignee relations | Ticket operations can select lanes, contacts, assignees, and tags that are individually valid but do not share a tenant. Reorder can move tickets across unrelated lanes. | Validate the complete lane/pipeline/subaccount graph plus every related resource in one transaction; use redacted projections and atomic same-tenant movement rules. |
| Automation/triggers/actions/instances | Persistence models exist without a complete authorized execution or editing boundary. | Keep dormant and inaccessible until a separate child defines tenant-scoped authoring, publication, execution, idempotency, and side-effect policy. No runtime is authorized by B5A. |
| Notifications UI/loaders | Agency/subaccount layouts currently rely on a broad agency notification read and in-memory filtering. | Query only authorized agency/subaccount visibility at persistence time; never use client/in-memory filtering as the authority boundary. |
| Direct page loaders | Several pages are protected by parent layouts but issue nested queries by leaf ID only. | Every loader must establish its own context and use conjunctive parent ownership; layout protection is defense in depth only. |

## Required adversarial matrices

Every implementation child must select the relevant cases below and prove
zero unauthorized reads, writes, provider calls, upload grants, notifications,
revalidations, and logs:

1. Anonymous, unprovisioned, null-agency, owner, admin, subaccount user, and
   guest actors.
2. Same-agency/same-subaccount, same-agency/other-subaccount, cross-agency,
   missing, deleted, orphaned, and parent-mismatched resources.
3. Duplicate, revoked, conflicting, cross-agency, stale, and concurrently
   changed permissions or invitations.
4. Caller substitution of agency, subaccount, funnel, page, pipeline, lane,
   ticket, tag, contact, assignee, media, notification, automation, and
   provider identifiers.
5. Nested confused-deputy combinations in which each individual identifier is
   valid but the combined ownership chain is not.
6. Zero-row, multi-row, stale expected-state, uniqueness collision, parallel
   create/update/delete, reorder race, and deletion-during-operation cases.
7. Batch requests containing one foreign, duplicate, missing, or malformed
   member; the whole mutation must fail atomically unless an explicit partial
   contract is separately approved.
8. Public unpublished/draft funnel, unknown domain/path, oversized input,
   duplicate submission, visit-counter race, and public-to-private boundary
   escalation.

Denials must be finite and non-enumerating. Unauthorized actions cannot reveal
whether a foreign resource exists, and raw provider/database errors, PII,
secrets, payloads, or caller markers cannot enter logs or client responses.

## Bounded child sequence

Each child requires its own READY work item, exact parent, Architect review,
Verifier contract, Acceptance implementation token, no more than two
remediation rounds, exact-SHA implementation review, execution seal, and
lifecycle seal.

| Child | Bounded responsibility | Explicit exclusions |
| --- | --- | --- |
| B5A1 | Closed authority inventory, source-discovery test, action taxonomy, ownership-path helpers, and synthetic contract harness. | No production mutation behavior. |
| B5A2 | Actor-safe agency/team/sidebar projections plus actor-derived notification/activity writes and persistence-scoped notification reads. | No email/push delivery, permission DDL, or automation runtime. |
| B5A3 | Upload-intent and media list/create/delete authority closure. | No new storage provider, migration, or cleanup of existing objects. |
| B5A4 | Authenticated funnel, funnel-page, and editor authoring authority closure. | No public-domain publication, visit effect, lead/checkout change, redesign, re-theme, or CRM forms. |
| B5A5 | Pipeline/lane hierarchy, tag scope, reorder, and default-pipeline authority closure. | No ticket relationship closure, CRM semantics, automation execution, or data migration. |
| B5A6 | Ticket CRUD/reorder and full contact/assignee/tag/lane relationship closure. | No new CRM fields, workflow semantics, or migration. |
| B5A7 | Agency/subaccount destructive lifecycle, remaining direct-query containment, and removal or quarantine of superseded legacy exports. | No provider expansion, public-route change, or schema change. |
| B5A8 | Dormant automation deny-by-default contract plus consolidated agency authority regression and closure inventory. | No automation runtime, scheduler, queue, agent, or external side effect. |

The Acceptance Orchestrator may split a child further if its exact gate cannot
remain independently reviewable. It may not merge domains merely to reduce the
number of seals.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| B5A-01 | A closed deterministic inventory covers every callable server boundary, direct database import/query, upload route, public route, and page-level write at the exact candidate SHA. |
| B5A-02 | Every private entry derives immutable actor identity server-side and validates a finite action; no email, provider role/metadata, UI state, layout, or caller authentication Boolean grants authority. |
| B5A-03 | Every nested read/write proves Agency → SubAccount → resource ownership in the query or transaction; valid-but-unrelated identifiers fail closed. |
| B5A-04 | Mutations use allowlisted DTOs, server-derived ownership/provider fields, expected prior state where relevant, and exact affected-row/cardinality assertions. |
| B5A-05 | Cross-agency, cross-subaccount, duplicate/conflicting permission, stale invitation, deletion, concurrency, batch, and confused-deputy matrices pass with zero unauthorized side effects. |
| B5A-06 | Public funnel, visit, lead, middleware, and checkout behavior is separately enumerated as `PUBLIC_REVIEW_REQUIRED`, remains unchanged and blocked, and cannot be mistaken for authority granted by B5A. |
| B5A-07 | Upload/media authority spans grant through persistence/deletion and rejects tenant or asset substitution without leaking storage/provider details. |
| B5A-08 | Authenticated funnel/editor, pipeline/lane, and ticket hierarchies enforce every parent relation, bounded content/order inputs, atomic batch rules, redacted projections, and stale-write behavior. |
| B5A-09 | Notification visibility is enforced in persistence predicates; activity events are actor-derived and contain no uncontrolled log/error/message data. |
| B5A-10 | Automation models remain unreachable by default until a separately authorized runtime contract exists. |
| B5A-11 | Permission `userId` DDL remains `DESIGN_REQUIRED`; Stripe/webhook/database/public-route contracts and all protected dependency/runtime surfaces retain their accepted behavior. |
| B5A-12 | Focused/full tests, lint, typecheck, build, frozen dependency continuity, secret/PII/log scans, exact-SHA reviews, and documentation/lifecycle seals pass. |
| B5A-13 | The final closure inventory contains no unresolved `UNMAPPED`, `IMPLICIT_LAYOUT_AUTHORITY`, `LEAF_ONLY_PREDICATE`, or `CALLER_TRUSTED_OWNER` disposition. |

## Stop conditions

- A callable or direct database surface cannot be deterministically enumerated.
- A child would need representative data, a credential, provider call, schema
  migration, deployment, or public-route expansion to prove local authority.
- A mutation cannot bind the actor, agency, subaccount, nested parent chain,
  and expected state without changing a separately gated domain contract.
- Permission closure requires inventing or applying the `userId` migration.
- Public and authenticated behavior cannot be separated without exposing draft
  content or weakening middleware.
- Work expands into CRM/Odoo, agentic runtime, Composio, re-theme, design
  system, dependency remediation, background automation, or deployment.

Any stop condition returns the child to Architect, Verifier, and Acceptance.
It does not authorize a workaround or broader mutation.

## Forbidden surfaces for this intake

This intake may add only this versioned work item. It may not change source,
tests, packages, lockfile, Prisma schema/migrations, SQL, environment files,
routes, middleware, providers, CI, Docker, Odoo, CRM, Composio, agent runtime,
design/theme assets, or deployment. It may not access a password manager,
credential, representative database, provider, external system, or network
service.

## Rollback

Rollback removes only this B5A intake document. It has no runtime, database,
provider, package, schema, route, visual, or deployment effect.

## Readiness and preserved holds

- Dependency audit: `STALE_UNREVALIDATED`.
- Current advisories: `UNKNOWN`.
- `CF-P1-AUDIT-FRESH-01`: open hard gate.
- Local application readiness: `FAIL`.
- Shared development readiness: `FAIL`.
- Staging readiness: `FAIL`.
- Pilot readiness: `FAIL`.
- Production readiness: `FAIL`.
- Public-runtime readiness: `FAIL`.
- Permission `userId` migration: `DESIGN_REQUIRED`.
- Parent B4F2B: `READY`.
- Boundary R: `BLOCKED`.

## Deferred sequence

After B5A is independently lifecycle-closed, Acceptance must separately gate
the Crewframe visual re-theme and taste-validation checkpoint already on the
product laundry list. Only after the agency control plane and visual shell are
validated may the CRM/Odoo introduction contract begin. This document grants
authority for neither phase.

## Status

`READY`

## Execution gate

`BLOCKED`

No B5A child implementation may begin until this exact intake receives
Architect, Verifier, and Acceptance approval.

## Human input

None for intake review. Human input is reserved for unavoidable external
authorization or the later subjective visual-taste gate.
