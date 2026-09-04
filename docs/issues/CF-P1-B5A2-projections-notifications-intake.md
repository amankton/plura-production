# CF-P1-B5A2 — Actor-safe projections and notification/activity intake

## Objective

Replace broad agency, subaccount, team, sidebar, and notification reads with
actor-derived, persistence-scoped projections. Replace the generic
caller-authored activity writer with a finite internal event contract that
cannot invent an actor, tenant, target, or message.

This issue is a documentation-only intake. It grants no production-change
authority. B5A2 is split into two independently reviewable implementation
children because projection reads and activity writes have different side
effects, rollback boundaries, caller sets, and confused-deputy risks.

## Immutable authority

- Accepted B5A1 lifecycle parent:
  `95e485acb089aca03c0351bbf85fb29ab91b8c85`.
- B5A1 lifecycle token: `ACCEPT_B5A1_LIFECYCLE_AND_PUSH`.
- B5A2 intake token: `GO_B5A2_INTAKE_GATE_AUTHORING`.
- Branch: `codex/crewframe-foundation`.
- Maximum remediation rounds for this intake and each implementation child:
  2.
- Target: fixed local repository input and pure synthetic tests only.

## Gate state

- Parent B5A: `READY`.
- B5A1: `DONE`.
- B5A2 intake: `READY`.
- B5A2A projection implementation: `BLOCKED_PENDING_EXACT_GATE_APPROVAL`.
- B5A2B notification/activity implementation:
  `BLOCKED_PENDING_B5A2A_LIFECYCLE_AND_EXACT_GATE_APPROVAL`.
- B5A3 through B5A8: `BLOCKED`.

No implementation child inherits production authority from this intake.

## Split decision

### B5A2A — Actor-safe projections

B5A2A owns 14 inventory records: identity entry, agency/subaccount entry and
settings loaders, both application layouts, all-subaccounts, sidebar-derived
types, the broad `getAuthUserDetails` action, and the team-member projection.
It is read-only except for the already accepted invitation/provisioning call
that an entry page invokes. B5A2A may preserve that accepted call and exact
behavior; it may not rewrite or expand it.

### B5A2B — Notification visibility and activity writes

B5A2B owns two inventory records: `getNotificationAndUser` and
`saveActivityLogsNotification`. The latter is currently called from 16 files,
accepts arbitrary caller text, accepts caller-selected tenant identifiers, and
falls back to choosing a database user when no provider actor exists. It cannot
be made safe by changing a return type or adding a layout check.

B5A2B must remove the generic client-callable writer. Its replacement is an
internal-only service with server-owned event templates and an actor/context
already resolved by the authoritative mutation. An owning B5A3-B5A7 domain
child may integrate one of those internal events only while sealing its own
mutation. Until then, an unsafe legacy call is removed rather than translated
into a new client-callable event-spoofing action. B5A2B may immediately
integrate only mutations already proven authoritative at its exact parent.

This sequencing intentionally permits a temporary reduction in activity-feed
coverage. It does not permit a false, forged, cross-tenant, or anonymous event.

## Exact B5A1 inventory binding

All and only the following 16 records are assigned to B5A2. Any source-hash
drift, missing record, duplicate record, additional B5A2 record, or assignment
change closes this intake and requires a new reviewed gate.

| Child | Exact `surfaceId` | Source hash |
| --- | --- | --- |
| B5A2A | `internal-only:src/app/(main)/agency/[agencyId]/settings/page.tsx#$db` | `sha256:6325f8b04cfc0fa56d8e85bd5707a425480f6e0be4a79343ce1841ebde6e0d48` |
| B5A2A | `internal-only:src/app/(main)/subaccount/[subaccountId]/settings/page.tsx#$db` | `sha256:aa7de29c77676c90e1284f8ef07739c20234778a2d6439031018181377822944` |
| B5A2A | `internal-only:src/lib/types.ts#__getUsersWithAgencySubAccountPermissionsSidebarOptions` | `sha256:57ee01f9500436294b413fda64c86b45693f4780bdb543897b5d4272cbdfcd74` |
| B5A2A | `internal-only:src/lib/types.ts#$db` | `sha256:57ee01f9500436294b413fda64c86b45693f4780bdb543897b5d4272cbdfcd74` |
| B5A2A | `layout loader:src/app/(main)/agency/[agencyId]/layout.tsx#default` | `sha256:60e507efcdb0ffc6df440afdd31d81ab48aaea15a36ece960ca5100525d63525` |
| B5A2A | `layout loader:src/app/(main)/subaccount/[subaccountId]/layout.tsx#default` | `sha256:d12f84b0abbee14d4fd62013cc765941381287b810b7e2c5e8974b9cdd8db08d` |
| B5A2A | `page loader:src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx#default` | `sha256:96ab560857c70226dab4a32e54b932dbd995ac12b7511aa2ef694842df863c54` |
| B5A2A | `page loader:src/app/(main)/agency/[agencyId]/settings/page.tsx#default` | `sha256:6325f8b04cfc0fa56d8e85bd5707a425480f6e0be4a79343ce1841ebde6e0d48` |
| B5A2A | `page loader:src/app/(main)/agency/page.tsx#default` | `sha256:e2cdf414c3bf1c82f0a8359b5f9cabd51b3d7a53dc1d7ee9a5f1c4ec8ea7f1e8` |
| B5A2A | `page loader:src/app/(main)/subaccount/[subaccountId]/settings/page.tsx#default` | `sha256:aa7de29c77676c90e1284f8ef07739c20234778a2d6439031018181377822944` |
| B5A2A | `page loader:src/app/(main)/subaccount/page.tsx#default` | `sha256:03cc81898f7eea3e7da544e19976849825c8d4602ba530f0f06f5e53831aa95b` |
| B5A2A | `provider callback:src/app/(main)/agency/page.tsx#$provider:clerk.currentUser` | `sha256:e2cdf414c3bf1c82f0a8359b5f9cabd51b3d7a53dc1d7ee9a5f1c4ec8ea7f1e8` |
| B5A2A | `server action:src/lib/queries.ts#getAuthUserDetails` | `sha256:9629a2bc0d55baafc00f6d0b80d7327ac37719fc2f367a0cdab5573456b0c4c2` |
| B5A2A | `server action:src/lib/queries.ts#getSubAccountTeamMembers` | `sha256:9629a2bc0d55baafc00f6d0b80d7327ac37719fc2f367a0cdab5573456b0c4c2` |
| B5A2B | `server action:src/lib/queries.ts#getNotificationAndUser` | `sha256:9629a2bc0d55baafc00f6d0b80d7327ac37719fc2f367a0cdab5573456b0c4c2` |
| B5A2B | `server action:src/lib/queries.ts#saveActivityLogsNotification` | `sha256:9629a2bc0d55baafc00f6d0b80d7327ac37719fc2f367a0cdab5573456b0c4c2` |

## B5A2A projection contract

Every projection entry resolves the Clerk provider subject on the server and
then resolves exactly one provisioned local actor. Missing, duplicate,
unprovisioned, null-agency, or otherwise invalid actors fail with the existing
finite non-enumerating access errors. Caller email, provider role/metadata,
layout reachability, UI state, and caller-provided user or agency records grant
no authority.

The implementation must replace the broad `getAuthUserDetails` graph with
purpose-specific server projections. It must not introduce another catch-all
actor/agency graph under a different name.

| Projection | Required context and persistence predicate | Maximum serialized fields |
| --- | --- | --- |
| Entry route | provider subject → exact local actor | actor `id`, `role`, `agencyId`; no Agency, Permission, or SubAccount graph |
| Agency shell/sidebar | `getAgencyContext(requestedAgencyId)` plus agency-operator policy | actor `id`, `role`; agency `id`, `name`, `address`, `agencyLogo`, `whiteLabel`; agency sidebar option `id`, `name`, `icon`, `link`; permitted subaccount summaries `id`, `name`, `address`, `subAccountLogo` |
| Subaccount shell/sidebar | `getTenantContext(requestedSubaccountId)` | the same actor fields; agency shell summary; exact subaccount summary and sidebar options; only subaccounts visible through the actor's privileged agency role or an active same-agency permission |
| All-subaccounts | agency operator context | agency `id`; subaccount `id`, `name`, `address`, `subAccountLogo`; no connected-account, customer, contact, notification, permission, or nested resource fields |
| Agency settings | agency operator context | editable agency profile `id`, `name`, `agencyLogo`, `companyEmail`, `companyPhone`, `whiteLabel`, `address`, `city`, `zipCode`, `state`, `country`, `goal`; actor profile `id`, `name`, `avatarUrl`, `email`, `role`; subaccount selectors `id`, `name` |
| Subaccount settings | exact tenant context | the same bounded actor profile; editable exact-subaccount profile `id`, `agencyId`, `name`, `subAccountLogo`, `companyEmail`, `companyPhone`, `address`, `city`, `zipCode`, `state`, `country`, `goal`; agency form context only as fields demonstrably required by the existing form; visible subaccount selectors `id`, `name` |
| Ticket assignees | exact tenant context | same-agency active permitted members only; user `id`, `name`, `avatarUrl`; include another field only if a focused test proves the existing ticket selector needs it and the child gate names it |

Every ORM query must contain the actor-derived agency key and, for tenant
reads, the exact requested subaccount key in its persistence predicate. A
later array `.find`, `.filter`, optional-chain selection, layout check, or
client component filter cannot substitute for that predicate. Agency-wide
owners/admins may see agency-authorized subaccounts only; non-privileged actors
may see only subaccounts with exactly one active same-agency permission under
the accepted permission semantics.

Settings loaders may call one projection service or several bounded services,
but cannot import `db`. `src/lib/types.ts` may contain static projection types;
it cannot execute a database query or import `db`. Prisma model types must not
be used to widen serialized props where a projection type is sufficient.

The `/agency` entry page may retain the accepted invitation/provisioning call
and a server-side provider profile read only for the existing create-agency
email display. That email remains display/input data, never identity or
authority. Existing redirect semantics for provisioned roles must remain
stable. The implementation must remove the current console output.

## B5A2B notification read contract

Notification reads use a purpose-specific internal server service, not a
generic action that accepts an agency ID from an arbitrary client.

- Agency layout: `getAgencyContext(requestedAgencyId)` plus agency-operator
  policy, then `notification.agencyId = context.agencyId`.
- Subaccount layout for an owner/admin: `getTenantContext(subaccountId)`, then
  `notification.agencyId = context.agencyId` under an explicit agency-wide
  notification-view action.
- Subaccount layout for a non-privileged actor:
  `notification.agencyId = context.agencyId AND
  notification.subAccountId = context.subaccountId` in the database query.
- Every result is a bounded view model: notification `id`, server-owned
  rendered message, `createdAt`, `subAccountId`; actor `id`, `name`,
  `avatarUrl`, `role`. User email, agency graph, and full User/Notification
  models are excluded.
- Results use deterministic `createdAt DESC, id DESC` ordering and an exact
  tested upper bound. If existing UI has no pagination, the implementation
  child must freeze a maximum rather than returning an unbounded feed.
- Foreign, deleted, missing, and parent-mismatched records yield the same
  non-enumerating denial/empty-result contract selected by the exact child
  gate. No raw database exception or input appears in logs or responses.

The subaccount layout must not read the agency-wide feed and filter it in
memory for restricted actors.

## B5A2B activity-write contract

`saveActivityLogsNotification` is removed as a client-callable server action.
There is no compatibility wrapper accepting `description`, `agencyId`,
`subaccountId`, user identity, actor name, role, or message text from a client.

Its replacement has these properties:

1. It is internal-only and receives a typed, already-resolved agency or tenant
   context from an authoritative server mutation. It cannot call an
   unauthenticated fallback or select an arbitrary user.
2. Its finite event type determines the server-owned message template and
   whether a subaccount target is required, forbidden, or optional. Unknown
   events and extra keys fail validation.
3. Actor ID, agency ID, subaccount ID, and resource ownership are derived from
   the context and the mutation's transaction result. A caller-supplied label,
   when an approved template needs one, is replaced with a bounded value read
   from the affected record and escaped for plain-text display.
4. The notification write is in the same transaction as the authoritative
   mutation, or consumes a transaction-bound immutable result that proves one
   affected row. A UI follow-up call is never evidence that a mutation
   happened.
5. Each supported event declares exact cardinality and duplicate behavior.
   Creation requires exactly one valid actor, one valid agency, zero or one
   context-valid subaccount as declared, and exactly one notification row.
6. A stale, zero-row, multi-row, duplicate, deleted-during-operation, foreign,
   or parent-mismatched result creates zero notifications and returns a finite
   non-enumerating error.
7. No raw caller description, provider/database error, payload, email,
   credential, stack trace, or tenant identifier is written to logs.

The initial finite registry may contain only events required by authoritative
mutations wired in the exact B5A2B candidate. Expected future domains are
agency goal/profile, subaccount profile/lifecycle, contact, upload/media,
funnel/page/products, pipeline/lane, ticket, and tag. Naming these domains does
not authorize their mutations or their events. Each later owning child must
add and test its event atomically with the mutation it seals.

## Transitive callers and compatibility/removal rules

The exact implementation gate must re-run deterministic caller discovery and
bind source hashes for every caller. At this intake parent, the known callers
are:

- `getAuthUserDetails`: agency entry, subaccount entry, all-subaccounts, and
  `src/components/sidebar/index.tsx`;
- `getSubAccountTeamMembers`: `src/components/forms/ticket-form.tsx`;
- `getNotificationAndUser`: agency and subaccount layouts; and
- `saveActivityLogsNotification`: agency goal, subaccount update/delete,
  contact, upload/media, funnel/page/products/editor, pipeline/lane,
  ticket, and tag UI paths across 16 files.

No legacy export may silently remain callable. The child must choose and test
one disposition per export:

- replace all callers with bounded purpose-specific projections and remove the
  export;
- make a projection internal-only and prove no client import path reaches it;
  or
- for activity writes, remove unsafe UI follow-up calls and add the event only
  inside an already authoritative mutation.

An adapter that preserves the broad return type, optional tenant ID, arbitrary
description, email-based actor selection, unauthenticated fallback, or
agency-wide read for restricted actors is forbidden. Type-only compatibility
aliases are allowed only when they reference the new bounded DTO and cannot
widen it.

## Required adversarial tests

Both children use fixed synthetic adapters and prove zero unauthorized reads,
writes, notifications, revalidations, provider calls, and logs.

### B5A2A

- anonymous, unprovisioned, missing actor, duplicate actor, null-agency,
  owner, admin, subaccount user, and guest cases;
- same agency/same subaccount, same agency/other subaccount, cross-agency,
  missing, deleted, orphaned, and wrong-parent route substitutions;
- zero, one, duplicate, revoked, false-access, foreign-agency, and stale
  permission rows;
- route agency/subaccount ID mismatch even when the leaf resource exists;
- no connected-account IDs, customer IDs, full permissions, inaccessible
  subaccounts, emails outside the actor-profile contract, or nested ORM graphs
  appear in any serialized projection;
- sidebar, settings, all-subaccounts, and entry redirects preserve the
  accepted behavior for authorized fixtures; and
- a source-discovery test fails if a known caller still imports a retired broad
  export, if `src/lib/types.ts` imports `db`, or if the two settings loaders
  retain a direct database import.

### B5A2B

- agency-wide versus exact-subaccount visibility is enforced in the adapter
  predicate, including a fixture where post-query filtering would leak;
- cross-agency notification, same-agency other-subaccount notification,
  mismatched notification/subaccount agency, deleted subaccount, missing
  actor, and unauthorized role cases;
- caller attempts to submit a description, actor, agency, role, email,
  subaccount outside context, unknown event, extra key, oversized label, raw
  error, or forged deletion/update event;
- zero-row, multi-row, duplicate invocation, stale result, deletion during the
  operation, and transaction rollback cases with exact notification counts;
- successful events have exactly one server-owned template, one context actor,
  one context agency, the declared subaccount cardinality, and one write;
- no unauthenticated fallback query and no raw `console.log`/`console.error`
  path remains in the owned notification surfaces; and
- caller discovery fails if the removed generic writer or broad reader is
  imported anywhere or if a new event is absent from the finite registry and
  test matrix.

## Evidence and verification

Each implementation child must produce bounded evidence containing:

- exact parent and candidate SHAs;
- the bound B5A1 records and pre/post source hashes;
- all transitive callers and their dispositions;
- projection field snapshots and explicit excluded-field assertions;
- policy, ownership-predicate, denial, cardinality, duplicate, stale, and
  deletion case counts;
- focused and full test, lint, typecheck, build, frozen offline install,
  inventory reconciliation, diff-check, and secret/PII/log scan results; and
- explicit confirmation that no network, representative database, provider,
  credential, schema, package, public route, deployment, re-theme, CRM/Odoo,
  or external action was used.

Evidence output contains only stable counts, hashes, pass/fail identifiers,
and repository-relative paths. It cannot contain source text, runtime IDs,
emails, payloads, environment values, stack traces, credentials, or
representative data.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| B5A2-01 | The exact 16 B5A1 records and source hashes reconcile, with 14 assigned to B5A2A and 2 assigned to B5A2B. |
| B5A2-02 | B5A2A and B5A2B have separate exact gates, candidate reviews, evidence seals, lifecycle seals, and at most two remediation rounds each. |
| B5A2-03 | Broad actor/agency ORM graphs are replaced by purpose-specific, allowlisted DTOs whose database predicates contain actor-derived agency and exact tenant ownership. |
| B5A2-04 | Layout, UI, optional-chain, and in-memory filtering are defense in depth only and never the authority boundary. |
| B5A2-05 | Entry, settings, all-subaccounts, sidebar, and ticket-assignee behavior remains stable for authorized fixtures without exposing foreign or excess fields. |
| B5A2-06 | Restricted notification feeds are tenant-filtered at persistence time, deterministically ordered, bounded, and serialized through a minimal view model. |
| B5A2-07 | The generic activity writer, arbitrary description, caller-selected ownership, email actor lookup, and unauthenticated fallback are absent. |
| B5A2-08 | Every implemented activity event is server-owned, finite, internal-only, transaction-bound to an authoritative mutation, cardinality-checked, and non-enumerating on denial. |
| B5A2-09 | Cross-agency, cross-subaccount, broad-projection, stale-state, duplicate, deletion, rollback, and confused-deputy tests pass with zero unauthorized side effects. |
| B5A2-10 | All transitive callers are inventoried; superseded exports are removed or provably unreachable from client imports; source discovery rejects regression. |
| B5A2-11 | Accepted invitation, account, team, contact, billing, commerce, webhook, worker, routing, and dependency behavior remains hash- or test-protected. |
| B5A2-12 | Focused/full tests, lint, typecheck, build, frozen install, inventory reconciliation, diff-check, and bounded secret/PII/log scans pass at each exact candidate and seal. |

## Allowed artifacts for later exact child gates

This intake itself may add only this work item and its review/lifecycle
metadata. A separately accepted implementation gate may allow only the
smallest necessary files under:

- purpose-specific account/projection or notification feature modules;
- the exact bound loaders/components and legacy query/type exports;
- focused synthetic tests and fixed-input verification tooling;
- B5A1 inventory source hashes/dispositions required by the exact accepted
  implementation; and
- bounded evidence, execution, and issue lifecycle documents.

The exact child gate must enumerate its concrete allowlist. Unlisted files are
forbidden.

## Preserved holds and forbidden work

- Dependency audit remains `STALE_UNREVALIDATED`; advisories remain `UNKNOWN`;
  `CF-P1-AUDIT-FRESH-01` remains open.
- Permission `userId` migration remains `DESIGN_REQUIRED`.
- Representative database/provider evidence and public runtime remain blocked.
- Local, shared-development, staging, pilot, and production readiness remain
  `FAIL`.
- No package, lockfile, Prisma schema/migration, SQL, permission DDL, email or
  push delivery, automation runtime, Stripe/provider expansion, public route,
  upload/media authority, funnel/publication authority, pipeline/ticket
  authority, credential, password manager, network service, deployment,
  release, re-theme, design/taste validation, CRM/Odoo, Composio, or agent
  runtime work is authorized.
- No representative user, agency, subaccount, notification, or provider data
  may be read or written.
- This issue cannot weaken or close another hold.

## Stop conditions

- Caller discovery does not reconcile all 16 bound records and all transitive
  callers at the exact child parent.
- An allowlisted projection cannot support the current authorized UI without
  serializing a credential, provider binding, inaccessible tenant, permission
  graph, or unrelated nested record.
- Safe notification creation requires a UI follow-up call, arbitrary event
  assertion, unverified resource identifier, schema change, queue, provider,
  or mutation owned by a blocked later child.
- Existing permission semantics cannot reject duplicate, stale, revoked, or
  foreign-agency access without the blocked `userId` migration.
- Verification requires representative data, network access, provider access,
  credentials, deployment, or public-route publication.

A stop returns the exact child to Architect, Verifier, and Acceptance. It does
not authorize a workaround or a broader implementation.

## Rollback

Rollback of this intake removes only this document. Each later implementation
child must define a file-exact rollback that restores its parent while leaving
accepted invitation/account/team/contact/billing/commerce/webhook behavior and
all preserved holds unchanged.

## Status

`READY`

## Execution gate

`BLOCKED`; no production implementation is authorized until Architect,
Verifier, and Acceptance approve this exact documentation candidate and
Acceptance issues a child-specific implementation token.
