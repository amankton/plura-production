# CF-P1-B5A2B — Notification visibility and activity-writer retirement

## Objective

Replace the broad notification reader with actor-derived, persistence-filtered
agency and subaccount views. Retire the generic client-callable activity writer
and every UI follow-up call without adding a live replacement event. Remove the
temporary B5A2A actor-name compatibility chain and add only a dormant, pure
finite-event service foundation for synthetic verification.

This work item is the documentation-only B5A2B implementation gate. It defines
the only source, test, tooling, inventory, and evidence changes that may occur
after exact approval. Production implementation remains blocked until then.

## Problem

The current notification reader accepts a caller-selected agency, returns an
unbounded broad ORM graph, and relies on in-memory tenant filtering. The current
activity writer accepts caller-authored identity, ownership, and message data,
including an unauthenticated actor fallback, from 18 UI follow-up calls.

## Goal

Close both B5A2B authority records with a bounded server-derived read model,
complete writer retirement, zero live replacement events, and independently
verifiable preservation of every authoritative owning mutation.

## Scope

Scope is limited to the two legacy exports, their exact reader/type/UI and
writer callers, the temporary actor-name compatibility chain, three closed
feature modules, fixed synthetic tests/tooling, inventory reconciliation, and
bounded evidence/lifecycle records enumerated in this gate.

## Non-goals

This gate does not restore activity coverage, integrate a production event,
change an owning mutation, remediate historical stored messages, alter schema
or dependencies, access representative systems/data, deploy, re-theme, or
begin CRM/Odoo, Composio, or agent-runtime work.

## Dependencies and blockers

B5A2A lifecycle acceptance at the exact parent is required and satisfied.
Implementation remains blocked on exact approval of this remediated gate.
Audit freshness, permission migration, representative provider/database,
public runtime, every readiness state, downstream B5A children, re-theme, and
CRM/Odoo remain hard holds as recorded below.

## Immutable authority

- Accepted B5A2 intake: `90b0cdb0855a3ee3971567b76242d59c7b2b26d5`.
- Intake token: `ACCEPT_B5A2_INTAKE_AND_PUSH`.
- Accepted B5A2A lifecycle parent:
  `7f236cbba1281c0bdaccbfa6770fcc0c128a4f80`.
- B5A2A lifecycle token: `ACCEPT_B5A2A_LIFECYCLE_AND_PUSH`.
- B5A2B gate-authoring token: `GO_B5A2B_IMPLEMENTATION_GATE_AUTHORING`.
- Gate-remediation token: `GO_B5A2B_GATE_REMEDIATION_1`.
- Gate remediation used: 1 of 2 rounds.
- Branch: `codex/crewframe-foundation`.
- Maximum gate or implementation remediation rounds: 2 each.
- Target: fixed local repository input and pure synthetic adapters only.
- Text hashes use UTF-8 SHA-256 after CRLF/CR normalization to LF. Binary
  hashes use raw bytes.

## Gate state

- Parent B5A: `READY`.
- B5A1 and B5A2A: `DONE`.
- B5A2 intake: `ACCEPTED`.
- B5A2B gate: `READY`.
- B5A2B implementation: `BLOCKED_PENDING_EXACT_GATE_APPROVAL`.
- B5A3-B5A8: `BLOCKED`.

No production authority is inherited from the intake or B5A2A.

## Exact two-record binding

B5A2B owns all and only these current authority-inventory records. The
historical intake hash changed mechanically during accepted B5A2A work; the
current inventory hash and retained declaration AST hashes below bind the
exact accepted parent.

| Exact `surfaceId` | Current source hash | Declaration AST hash | Required closure |
| --- | --- | --- | --- |
| `server action:src/lib/queries.ts#getNotificationAndUser` | `sha256:deb9ea72e91318876ce5d6c7c2c28daec8a40d2d0611a655ee58446ef2520d1e` | `sha256:cfe7c297af8f19b6c0f1a72f078acf28f13a90a009b498d8b0464b3b59931a83` | Remove the export and replace its two layout calls with internal actor-safe views. |
| `server action:src/lib/queries.ts#saveActivityLogsNotification` | `sha256:deb9ea72e91318876ce5d6c7c2c28daec8a40d2d0611a655ee58446ef2520d1e` | `sha256:5a5a1ccfbaa03dce8f4db75ed5a79a2cce43972be611f972e5bdba1e002c8f1c` | Remove the export, all 16 imports, and all 18 UI follow-up calls; add no live replacement. |

No alias, wrapper, re-export, namespace access, computed-property access,
dynamic import, compatibility action, or renamed equivalent may preserve
either legacy surface.

## Frozen implementation decisions

The implementation is closed over these decisions:

- latest-feed maximum: exactly 100 items;
- overflow sentinel: adapters request at most 101 rows and the pure service
  fails closed when the sentinel is present;
- ordering: `createdAt DESC, id DESC` in persistence and verified again before
  fresh-object mapping;
- serialized date: canonical `createdAt` ISO-8601 string;
- serialized message field: `message`, treated as untrusted plain text, never
  HTML, with a maximum of 1,024 Unicode code points;
- actor display bounds: `name` at most 256 Unicode code points and `avatarUrl`
  at most 2,048 Unicode code points;
- authorized empty feed: `[]`;
- anonymous: `UNAUTHENTICATED`;
- missing local actor: `PROVISIONING_REQUIRED`;
- invalid, missing, deleted, foreign, or unauthorized requested scope:
  `FORBIDDEN`;
- duplicate IDs, over-limit results, malformed fields, invalid dates, or a
  returned notification/user/subaccount ownership mismatch: `CONFLICT` with
  no partial feed; and
- production activity registry/template/event/caller count: exactly zero.

These outcomes use the existing finite `AccessError` contract. No selector,
record existence, raw database error, or rejected value is exposed.

## Closed feature architecture

The implementation may add exactly three production modules:

1. `src/features/notifications/notification-view-service.ts` exports exactly
   two runtime symbols: `createNotificationViewService` and
   `assertNotificationViewAction`. It contains only DTOs, finite record/store
   interfaces, the exact local action policy, validation,
   ownership/cardinality checks, ordering verification, and fresh-object
   mapping.
2. `src/features/notifications/server-notification-view-service.ts` imports
   `server-only`, the accepted agency/tenant context resolvers, and Prisma. It
   exports the sole runtime symbol `notificationViewService`, with
   `getAgencyFeed(requestedAgencyId)` and
   `getSubaccountFeed(requestedSubaccountId)` methods.
3. `src/features/notifications/activity-foundation-service.ts` exports the
   sole runtime symbol `createActivityFoundationService`. It contains pure
   strict validation/rendering and dependency-injected atomic create-once
   interfaces. It imports no database, provider, Next runtime, context adapter,
   route, action, or client module and has zero production callers.

Type-only exports are allowed only for the exact DTO, store, context receipt,
event definition, service types, and
`NotificationViewAction = 'notification:view-agency' |
'notification:view-subaccount'` required by those runtime symbols. No `any`,
broad `unknown` cast, index signature that bypasses strict input keys, Prisma
model alias, object spread from a database record, or generic authority wrapper
is allowed.

### Exact notification action policy

`assertNotificationViewAction(role, action)` uses a closed local matrix:

- `AGENCY_OWNER` and `AGENCY_ADMIN` may perform both
  `notification:view-agency` and `notification:view-subaccount`;
- `SUBACCOUNT_USER` and `SUBACCOUNT_GUEST` may perform only
  `notification:view-subaccount`; and
- an unknown role, unknown action, or disallowed pair fails `FORBIDDEN`.

The action is selected inside `server-notification-view-service.ts`; it never
comes from a request, route, client, provider metadata, or caller-owned object.
The agency method selects `notification:view-agency`, resolves context, applies
`assertAgencyOperator`, applies `assertNotificationViewAction`, and only then
queries. The subaccount method selects `notification:view-subaccount`, resolves
tenant context, applies `assertNotificationViewAction`, and only then branches.
Before an owner/admin branch performs an agency-wide query, it additionally
applies `assertNotificationViewAction` with the internally selected
`notification:view-agency`; restricted actors can reach only the exact-
subaccount predicate.

## Notification view contract

### Exact DTO

Each feed returns a fresh readonly projection:

- `viewerRole`: the role derived from the accepted server context; and
- `notifications`: at most 100 readonly items with exactly:
  - `id`;
  - `message`;
  - `createdAt` as an ISO string;
  - `subAccountId` as string or null; and
  - `actor` with exactly `id`, `name`, `avatarUrl`, and `role`.

The projection excludes email, agency/user timestamps, provider data, full
User/Notification/SubAccount/Agency models, relations, permissions, customer
or connected-account fields, and every unlisted key. Existing stored messages
are historical untrusted plain text; B5A2B does not claim they were generated
by a server-owned template or perform a data migration.

### Agency feed

`getAgencyFeed(requestedAgencyId)` resolves `getAgencyContext` internally and
applies `assertAgencyOperator`. Its read predicate includes:

`Notification.agencyId = context.agencyId AND User.agencyId =
context.agencyId AND (SubAccount IS NULL OR SubAccount.agencyId =
context.agencyId)`.

The adapter selects only the exact record fields needed for the DTO, uses the
fixed order and 101-row sentinel, and returns no relation object directly.

### Subaccount feed

`getSubaccountFeed(requestedSubaccountId)` resolves `getTenantContext`
internally. Owner/admin actors use the same agency-wide predicate as the agency
feed and retain the existing authorized current-subaccount UI filter. Every
other authorized role uses this persistence predicate:

`Notification.agencyId = context.agencyId AND Notification.subAccountId =
context.subaccountId AND User.agencyId = context.agencyId AND
SubAccount.id = context.subaccountId AND SubAccount.agencyId =
context.agencyId`.

A restricted actor must never receive an agency-wide result for later
in-memory authorization filtering. UI filtering is presentation-only after
the server has returned a feed the actor is already authorized to receive.

Every returned row is validated as one unique notification, one same-agency
actor, and either no subaccount or the declared same-agency subaccount. One
invalid row rejects the complete feed. Reads create no database writes,
notifications, revalidations, provider calls beyond accepted identity lookup,
or logs.

## Exact reader closure

At the accepted parent there are exactly two imports and two calls, with no
aliases, namespace calls, dynamic imports, or re-exports.

| Caller | Parent source hash | Call AST hash | Candidate disposition |
| --- | --- | --- | --- |
| `src/app/(main)/agency/[agencyId]/layout.tsx` | `sha256:60e507efcdb0ffc6df440afdd31d81ab48aaea15a36ece960ca5100525d63525` | `sha256:c2e917af7760349a27f6f8a4fa87bda3712ca9772bbe5ac3bcbb0c9be775671f` | Replace with `notificationViewService.getAgencyFeed(params.agencyId)` and consume its exact DTO. |
| `src/app/(main)/subaccount/[subaccountId]/layout.tsx` | `sha256:d12f84b0abbee14d4fd62013cc765941381287b810b7e2c5e8974b9cdd8db08d` | `sha256:c2e917af7760349a27f6f8a4fa87bda3712ca9772bbe5ac3bcbb0c9be775671f` | Replace the agency-wide read plus restricted in-memory authority filter with `notificationViewService.getSubaccountFeed(params.subaccountId)`. |

Both `verifyAndAcceptInvitation()` calls remain exact and the accepted global
total remains four. Agency operator denial, tenant denial, redirects, shell
layout, and child rendering remain behaviorally unchanged.

The transitive broad UI/type path also closes:

| Path/symbol | Parent source hash | Required change |
| --- | --- | --- |
| `src/lib/types.ts#NotificationWithUser` | `sha256:0988eaf889904009f28292461af4cfc2f27b4c54f691332b665c99681fbaa7ef` | Remove the Prisma-expanded alias and its now-unused `Notification` import. Use the exact feature DTO type. |
| `src/components/global/infobar.tsx#InfoBar` | `sha256:5bdb12949ed2dc6cda650f426226a772af41d295f63bc256f45b74aaeef339cf` | Consume the exact projection fields while preserving bell, sheet, copy, empty state, operator toggle, avatar/name, message text, and date presentation. |

`InfoBar` cannot parse HTML or use `dangerouslySetInnerHTML`. The property
adaptation may replace legacy `User` and `notification` accesses only with the
exact `actor` and `message` fields.

## Exact writer-call closure

At the accepted parent there are exactly 16 importers and 18 call expressions,
with no aliases, namespace calls, dynamic imports, or re-exports.

| Exact caller | Calls | Parent source hash | Call AST hash(es) |
| --- | ---: | --- | --- |
| `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/delete-button.tsx` | 1 | `sha256:3e93119e4c07021488b9a1440045d4609a594cb04c0d185861fa0e54cbad9955` | `sha256:b31aa42c37bce95cd5569eeabb827e49a8f01279c2fbf76cd1d92fafa56bc5d4` |
| `src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/_components/funnel-products-table.tsx` | 1 | `sha256:1fafe3e0f39798f3286ee454e3e1d60ee90373ff3bf39a9c7f1423a8b2b4636d` | `sha256:74deab8d0b2ec673236ccd51f7e1de7d7cfb6290ca0cb053636e2a7471258881` |
| `src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor-navigation.tsx` | 1 | `sha256:4f6bd56b83f6a94d43317331d63a9ed16d42b00ad7cf39bcd2219aa2a0199162` | `sha256:57eb0b350b99d3387da0371f7bd3aaaa62b2462419829057ed162d93826ef4a5` |
| `src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-lane.tsx` | 1 | `sha256:5f8689736e968dfeb53a51a183594822868c88bba9cfc050b0680631a45596c6` | `sha256:821b374d30d96c6fcbde37629b357b7cc8c86455bee2930828bda3cdceac0681` |
| `src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-ticket.tsx` | 1 | `sha256:3fa71d96ae3b365c53239331b523f0ce5f8d370604b778c68f422f5be59a36e9` | `sha256:81b76339b9fda4d0d903e89db51e6011b493076e3e641687906f11ba10ef2631` |
| `src/components/forms/agency-details.tsx` | 1 | `sha256:af4b100d9a66f5191ad8511848f288f066125bff3e2b63402de89d1ac51f4e9f` | `sha256:87b4e688861a7b23c425d0cf64862691b7db49a05ff8ae211f76e1b4d4501d9f` |
| `src/components/forms/contact-user-form.tsx` | 1 | `sha256:fa362a8c6a2401599818e62cefba939a395ca658f36046b6865303367044e817` | `sha256:d2f50512210ce0a3a2f760e28e88a69c8f001c9f1a7b171f432c869a3d20ffc1` |
| `src/components/forms/create-pipeline-form.tsx` | 1 | `sha256:9a4d2c61b9a9a8a61ad723a3d6f7814f40afd812de5046b981ac2765d4ab2957` | `sha256:19e53bfc1c747e22a793f6152b6ce73363084ac2625a7c15765d74ee78cc1438` |
| `src/components/forms/funnel-form.tsx` | 1 | `sha256:b68061d60037b37eed50dcb7820c53777007021a97ba005eef321ef5f7a5b84c` | `sha256:e08fc596f3db76084704a021de77ed24bd3667762ba86192544325102a977c90` |
| `src/components/forms/funnel-page.tsx` | 2 | `sha256:12a24501e949b0b577bd43766fd7d09685f4454bd64abf7b92d28ddd228181ea` | `sha256:57eb0b350b99d3387da0371f7bd3aaaa62b2462419829057ed162d93826ef4a5`; `sha256:4a0c33b950122100e8adc8471a97698d5a73cd73daff1cdae3593fa4c2b44621` |
| `src/components/forms/lane-form.tsx` | 1 | `sha256:1aab9ccd4f1f4d74c4d46d930f154bfb613f58671cb7fdad8208bef97a71ce3d` | `sha256:b7c305d320e967330ee460d4dbeb63dc1d35f33097d930a8a6edc8b3fd91219f` |
| `src/components/forms/subaccount-details.tsx` | 1 | `sha256:589392b2dd80805132b05b8350e0ed340835b57136b8d45d5c6cebc305ab73f8` | `sha256:183d9c7ec7e2adad335117e89d1b75c4d788e6d9cdb86fb2429148997e65854f` |
| `src/components/forms/ticket-form.tsx` | 1 | `sha256:8ef7b66b70acfbc80866e9d60a8e84d098327d30c89759b74789e17aa5d5cf4a` | `sha256:840ab41e509d43bc8bd53e83d37028b01adcc0e2011934e378480d690484dfec` |
| `src/components/forms/upload-media.tsx` | 1 | `sha256:50a8ca1a26a883b73d08e841cfda6e4fbae94f76756dcb2abee0a594a5828a0d` | `sha256:1f09739c9296cdee93ac6c0ad68827841315538c1c411046773ea110f442dc18` |
| `src/components/global/tag-creator.tsx` | 2 | `sha256:80fc7f875c72d057c9aa0fb69ca3e28cb512cd9a13ec67550c409243338e6ba7` | `sha256:fb54634ef1b8be5e5f20369cd2495e45f19c8fd055775aea88eca2dadb4ed371`; `sha256:15954d1dcc0dc6656f85256676e5afd0bcfac2f1d048746b24f53d7ddef1fb87` |
| `src/components/media/media-card.tsx` | 1 | `sha256:df932fcb115bdceb6d80be01c3c9771b5b79f292fd2390c3ae5595378b7710b7` | `sha256:a40b5e37fbc5bfb53b9c325c6c49cbc730696ea0957cf73cc1b7637ba42da20a` |

Each import specifier and follow-up call statement is removed, not translated
into an event, action, request, queue, callback, worker, log, or provider call.
The authoritative agency-goal, subaccount, contact, upload/media, funnel/page,
funnel-product/editor, pipeline/lane, ticket, and tag mutations remain exact.

For every caller, the verifier removes only the legacy import specifier and
complete legacy call statement from the accepted parent and candidate, prints
the normalized AST with the repository TypeScript version, and compares the
whole remainder. If an awaited mutation result binding becomes unused solely
because the follow-up call is removed, the candidate may remove only that
binding while retaining the identical awaited mutation call, arguments, and
statement position. Toast, modal, state, navigation, refresh, success/error,
and cleanup paths otherwise remain exact.

## Temporary actor-name chain removal

All eight files and every origin, query, helper, projection, prop, mapping, and
sink in this temporary chain are removed. At the parent there are exactly 14
`legacyActivityActorName` lines, 3 `listLegacyActorNames` lines, 4
`getLegacyActorName` lines, and 9 activity-only `userName` lines.

| Exact path | Parent source hash |
| --- | --- |
| `src/features/agency-projections/projection-service.ts` | `sha256:df15a0a9cf9a216119182571b1f494308aa11dbf1ad28bf5fa6fb72eb34a2541` |
| `src/features/agency-projections/server-projection-service.ts` | `sha256:3bef7ee8c4519bf30256b82e717a4c2ab40e98c55e2f2a4f26f70edf5f9f7c08` |
| `src/components/sidebar/index.tsx` | `sha256:9a3fe9f9122890a678a7932d32d03da641dc82515bd7a4dae0f6a0f6eaed8a48` |
| `src/components/sidebar/menu-options.tsx` | `sha256:97db3054168a16f3ce38792524275c9c0b175ade98a1c533ef595c91ba2a8a8c` |
| `src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx` | `sha256:5fb0f5c29e1186e3efb37dac5b5dd51c6468b6ced1928ea431c009955e3fd77b` |
| `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx` | `sha256:7ff6aaa0ff61d1388336d59453a2c65fb1bb6e58ed1b93074ae71a7f1ae25546` |
| `src/components/forms/subaccount-details.tsx` | `sha256:589392b2dd80805132b05b8350e0ed340835b57136b8d45d5c6cebc305ab73f8` |
| `src/app/(main)/subaccount/[subaccountId]/settings/page.tsx` | `sha256:87764d51839054101e116474c0699aeaa5113cb6574446050bfe39806fa5be3e` |

The removal includes `ProjectionServiceDependencies.listLegacyActorNames`,
`getLegacyActorName`, its server adapter, three helper invocations, the three
projection properties/result mappings, both Sidebar-to-MenuOptions mappings,
the all-subaccounts mapping, all three `SubAccountDetails.userName` mappings,
and the form prop/destructuring/description use. The accepted
`projection.actor.name` remains because `UserDetails` still consumes the exact
ActorProfile; only its activity-only mapping is removed.

The privileged subaccount control path is additionally bound node by node:

| Exact parent node | Kind | Parent AST hash |
| --- | --- | --- |
| `getSubaccountSidebarProjection/includeLegacyName` declaration | `VariableStatement` | `sha256:8880e1739333046513c7b48ad099bf95505c295717cf52f17147248212fbac0b` |
| `Promise.all` element conditioned by `includeLegacyName` | `ConditionalExpression` | `sha256:a6648029bf425722674a234b71219abc46e5b5b732ff415f56f77c8ab81a4327` |
| Complete tuple declaration with `legacyName` at binding index 4 | `VariableDeclaration` | `sha256:da18ceba4cbabc973e0c82a52334a466cdaacb45d927cbdedb310d1ecfbb98de` |
| Supplementary `legacyName` tuple binding element | `BindingElement` | `sha256:d1624507371a52ba6fb5ac63e381ffadce58a6ee01213491523a3b31efac85b0` |
| `legacyName === null` guard and return | `IfStatement` | `sha256:b2e2cc619ca660bf7d3ff57cd6e6d3a7d3398a3d60f77df08c49c0dc01564654` |
| Returned `legacyActivityActorName: legacyName` mapping | `PropertyAssignment` | `sha256:d8dd8e46ffb555e874d73ca923a74de3355a3a5170271783ada2bdab5da1c27e` |

Each authoritative node must be removed and mutated independently in fixed
fixtures. The complete tuple declaration hash is the primary binding; the leaf
binding-element hash is supplementary and cannot replace whole-declaration
remainder verification.

No renamed actor-name scalar, display-name helper, UI-provided description, or
equivalent compatibility path may replace this chain. Create-subaccount role
gating, modal availability, form data, submission, toast, and refresh behavior
remain exact.

## Dormant activity foundation

B5A2B authorizes no live activity event. The production activity foundation
contains zero event definitions, zero templates, zero registry entries, zero
adapters, and zero callers. Its factory accepts a strict finite registry and
an atomic create-once store only through dependency injection.

Synthetic tests may configure exactly one test-owned event named
`FOUNDATION_VALIDATION_ONLY` with one server-owned template. They prove strict
unknown/extra-key rejection, bounded plain-text labels, resolved-context-only
actor/agency/subaccount ownership, authoritative-mutation receipt cardinality,
idempotent duplicate behavior, conflict handling, transaction rollback, and
exactly one fake write for one valid receipt.

The factory accepts no raw `description`, actor name, actor ID, role, email,
agency ID, subaccount ID, provider object, database error, payload, or caller
message. A resolved context and mutation receipt are test-only values in
B5A2B; no existing production mutation may construct or pass them.

No event constant or template for agency, subaccount, contact, upload/media,
funnel/page/products/editor, pipeline/lane, ticket, tag, email, push,
automation, or provider behavior may enter production source. A live event
requires a new owning-domain gate, transaction-bound authoritative-mutation
proof, exact cardinality/idempotency design, and separate Architect, Verifier,
and Acceptance approval.

## Expected inventory reconciliation

The candidate removes the two bound server-action records and adds exactly:

- `internal-only:src/features/notifications/notification-view-service.ts#createNotificationViewService` — read-only, `INTERNAL_ONLY`, `ACCEPTED_RETAIN`;
- `internal-only:src/features/notifications/notification-view-service.ts#assertNotificationViewAction` — no-op policy assertion, `INTERNAL_ONLY`, `ACCEPTED_RETAIN`;
- `internal-only:src/features/notifications/server-notification-view-service.ts#$db` — read-only, `INTERNAL_ONLY`, `ACCEPTED_RETAIN`;
- `internal-only:src/features/notifications/server-notification-view-service.ts#notificationViewService` — read-only, `INTERNAL_ONLY`, `ACCEPTED_RETAIN`; and
- `internal-only:src/features/notifications/activity-foundation-service.ts#createActivityFoundationService` — no-op dormant boundary, `INTERNAL_ONLY`, `DORMANT_BLOCKED`.

The inventory schema and finite taxonomies remain unchanged. The exact
candidate counts are: 231 records, 22 database imports (21 direct and 1
injected), 5 server-action files, 50 server-action exports, 36 query exports,
5 API-route files, 6 API handlers, 24 pages, 7 layouts, 4 upload routes, 4
upload callbacks, and 33 provider boundaries. A different count is a gate
failure, not an invitation to weaken discovery.

## Concrete file allowlist

After exact gate approval, B5A2B may add or modify only these files.

### New production boundary

- `src/features/notifications/notification-view-service.ts` (new)
- `src/features/notifications/server-notification-view-service.ts` (new)
- `src/features/notifications/activity-foundation-service.ts` (new)

### Reader, type, and legacy-name closure

- `src/lib/queries.ts`
- `src/lib/types.ts`
- `src/app/(main)/agency/[agencyId]/layout.tsx`
- `src/app/(main)/subaccount/[subaccountId]/layout.tsx`
- `src/components/global/infobar.tsx`
- `src/features/agency-projections/projection-service.ts`
- `src/features/agency-projections/server-projection-service.ts`
- `src/components/sidebar/index.tsx`
- `src/components/sidebar/menu-options.tsx`
- `src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx`
- `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx`
- `src/app/(main)/subaccount/[subaccountId]/settings/page.tsx`

### Exact writer callers

- `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/delete-button.tsx`
- `src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/_components/funnel-products-table.tsx`
- `src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor-navigation.tsx`
- `src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-lane.tsx`
- `src/app/(main)/subaccount/[subaccountId]/pipelines/_components/pipeline-ticket.tsx`
- `src/components/forms/agency-details.tsx`
- `src/components/forms/contact-user-form.tsx`
- `src/components/forms/create-pipeline-form.tsx`
- `src/components/forms/funnel-form.tsx`
- `src/components/forms/funnel-page.tsx`
- `src/components/forms/lane-form.tsx`
- `src/components/forms/subaccount-details.tsx`
- `src/components/forms/ticket-form.tsx`
- `src/components/forms/upload-media.tsx`
- `src/components/global/tag-creator.tsx`
- `src/components/media/media-card.tsx`

### Fixed tests and verification

- `tests/notifications/notification-view-service.test.ts` (new)
- `tests/notifications/activity-foundation.test.ts` (new)
- `tests/notifications/notification-surface.test.ts` (new)
- `scripts/verify-b5a2b-notification-boundary.ts` (new)
- `scripts/verify-b5a2a-projections.ts` (only the exact superseded compatibility
  and B5A2B layout changes; all unrelated B5A2A assertions remain effective)
- `tests/agency-projections/projection-service.test.ts` (same limitation)
- `tests/agency-projections/projection-surface.test.ts` (same limitation)
- `scripts/agency-authority-inventory-lib.ts` (only exact new/removed symbol,
  action, ownership, effect, disposition, and count reconciliation)
- `tests/authority-inventory/agency-authority-inventory.test.ts` (only exact
  B5A2B drift assertions)
- `docs/security/agency-authority/inventory.json`
- `docs/security/agency-authority/inventory.lock.json`

### Evidence and lifecycle

- `docs/evidence/CF-P1-B5A2B-candidate-verification.json` (new)
- `docs/execution/CF-P1-B5A2B-notification-activity-boundary.md` (new)
- this work item for later exact lifecycle metadata only

Unlisted source, test, tooling, inventory, documentation, package, schema,
configuration, public, provider, and deployment files are forbidden.
Historical B5A2A evidence and execution records remain byte-exact.

## Required adversarial verification

### Reader authority and DTO

- owner/admin agency feed; non-operator agency denial; owner/admin subaccount
  agency feed; subaccount user and guest exact-subaccount feed;
- anonymous, unprovisioned, null-agency, foreign agency/subaccount, missing or
  deleted scope, revoked/false/duplicate permission, and wrong-parent route;
- foreign actor, same-agency other-subaccount notification for a restricted
  actor, notification/actor agency mismatch, notification/subaccount agency
  mismatch, missing/deleted actor or subaccount, duplicate notification ID,
  malformed field, invalid date, and overflow;
- a fixture that would leak if an agency-wide result were filtered only after
  persistence;
- authorized empty result, exact 100-item result, 101st-row rejection, and
  stable ties under `createdAt DESC, id DESC`; and
- exact DTO snapshots plus explicit rejection of email and every broad model,
  graph, relation, permission, provider, customer, and unlisted field.

### Writer and compatibility retirement

- zero legacy exports, importers, calls, aliases, wrappers, re-exports,
  namespace/computed access, or dynamic imports;
- independent mutations of all 18 parent call nodes and all 16 imports;
- whole-remainder mutations of every protected non-removal statement and every
  owning mutation invocation in all 16 files;
- zero `legacyActivityActorName`, `listLegacyActorNames`,
  `getLegacyActorName`, activity-only `userName`, or equivalent renamed path;
- mutation of each origin, helper, adapter, projection, result mapping, prop,
  JSX mapping, and sink independently; and
- preservation of all authoritative mutation calls/arguments/order and
  unrelated success, error, toast, state, modal, navigation, refresh, and
  cleanup behavior.

### Dormant foundation and negative reachability

- exactly one synthetic registry event/template and zero production
  registry entries/templates/events/callers;
- strict rejection of an unknown event, extra key, caller-authored message,
  actor, agency, role, email, raw error, payload, foreign subaccount, malformed
  context, zero/multiple mutation rows, stale/deleted result, duplicate
  conflict, oversized/control/delimiter-bearing label, and rollback;
- exact one-write behavior in a fake atomic store and zero writes/logs for
  every denied case; and
- source injection tests for one production event, domain event literal,
  adapter, action, route, mutation-side call, provider/worker/scheduler import,
  Notification create/upsert/update, or production foundation importer.

### Action-policy and compatibility control mutations

- mutate each role/action pair, action literal, internal selection point, and
  pre-query assertion independently;
- inject caller-supplied action or role selection and prove rejection;
- mutate each of the six bound privileged-name control nodes independently;
  and
- preserve the accepted actor-profile name while rejecting any activity-only
  compatibility alias or sink.

## Fixed-input verifier and protected remainder

`scripts/verify-b5a2b-notification-boundary.ts` takes zero arguments and reads
only fixed versioned paths. It cannot receive paths, symbols, ignore lists,
hashes, limits, or taxonomies from arguments or environment values.

Using the repository TypeScript version, it parses the accepted parent and
candidate, normalizes line endings, removes or type-erases only the exact
allowlisted B5A2B nodes, prints normalized AST with LF newlines, and compares
the complete remainder for:

- `src/lib/queries.ts`;
- both layouts;
- `src/lib/types.ts` and `src/components/global/infobar.tsx`;
- all 16 writer callers;
- both agency-projection service files; and
- all compatibility consumers.

It also verifies every selected field, predicate, bound, order term, DTO key,
denial path, exported runtime symbol, inventory record/count, zero-reachability
condition, and accepted frozen behavior. Tests must mutate every non-ignored
top-level statement and every owning mutation call to prove the normalization
cannot hide unrelated drift.

Verifier output is bounded to stable counts, hashes, and pass/fail identifiers.
It emits no source, descriptions, messages, names, emails, selectors, payloads,
provider/database errors, environment values, secrets, credentials, stack
traces, or representative data.

## B5A2A verification-policy amendment

At a documentation-only B5A2B gate SHA, the immutable B5A2A verifier is
expected to exit nonzero with exactly this one diagnostic and no other output
failure:

`B5A2A_FAIL errors=1 first=allowlist:docs/issues/CF-P1-B5A2B-notification-activity-boundary.md`.

This is a single-path gate-authoring exception, not a passing B5A2A result and
not authority to suppress or weaken the verifier. The error count must be one.
No other diagnostic, stderr, crash, timeout, skipped check, wrapper, output
filter, ignored exit code, environment switch, or verifier modification is
allowed. All other B5A2A assertions must execute successfully.

The exact-SHA gate review records the command, nonzero status, exact diagnostic,
accepted parent, frozen gate SHA, and sole-file diff. Before B5A2B implementation
candidate review, the implementation must narrowly update the B5A2A verifier
for only the gate-enumerated B5A2B paths and explicitly superseded nodes and
restore a full `B5A2A_PASS`. Every unaffected hash, algorithm, baseline,
mutation test, and invariant remains exact; broad skips and whole-file
exemptions are forbidden. The new B5A2B verifier independently proves each
newly allowed change and that unrelated drift still fails.

## Candidate verification and evidence

Required commands at the exact immutable candidate and seals:

1. `bun scripts/verify-b5a2b-notification-boundary.ts`
2. `bun scripts/verify-b5a2a-projections.ts` — at the documentation-only gate,
   only the exact single diagnostic above is accepted; at implementation
   candidate and later seals, full `B5A2A_PASS` is required
3. `bun scripts/verify-agency-authority-inventory.ts`
4. focused notification, agency-projection, and inventory tests
5. full `bun test`
6. `bun run lint`
7. `bun run typecheck`
8. `bun run build`
9. frozen offline dependency continuity with the accepted lockfile
10. `git diff --check`, exact allowlist, protected-remainder, and bounded
    secret/PII/log/network/provider/schema/package/public/deployment scans

Evidence records exact parent/gate/candidate/seal SHAs; the two-record closure;
2 reader imports/calls; 16 writer imports; 18 writer calls; the complete
temporary-name ledger; pre/post inventory records/counts/hash; exact DTO,
policy, persistence-predicate, denial, cardinality, ordering, overflow,
stale/deletion, rollback, mutation-remainder, test, and command counts; and
explicit zero-use statements for network, provider, representative database or
data, credentials, schema, packages, public routes, live events, external
actions, deployment, re-theme, CRM/Odoo, Composio, and agent runtime.

Evidence contains only stable counts, hashes, pass/fail identifiers, SHAs, and
repository-relative paths. It contains no source text, runtime IDs, stored
messages, caller descriptions, names, emails, payloads, environment values,
errors, stack traces, secrets, credentials, or representative data.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| B5A2B-01 | Candidate ancestry, exact parent/gate SHAs, clean worktree, LF-normalized hashes, and concrete allowlist reconcile. |
| B5A2B-02 | Exactly the two bound legacy records and their 2 reader calls, 16 writer imports, 18 writer calls, transitive UI/type path, and complete temporary-name chain close. |
| B5A2B-03 | Both legacy exports and every alias, wrapper, re-export, namespace/computed access, dynamic import, and callable compatibility surface are absent. |
| B5A2B-04 | Agency and subaccount feeds derive identity and context internally; caller role, email, agency, actor, UI state, or layout reachability grants no authority. |
| B5A2B-05 | Persistence predicates contain exact actor-agency and requested-scope ownership; restricted actors never receive an agency-wide result for post-query authorization filtering. |
| B5A2B-06 | The feed has only its exact DTO, ISO timestamps, fixed bounds, `createdAt DESC, id DESC` order, row-parent validation, finite denial contract, and no partial result. |
| B5A2B-07 | All 16 writer imports and 18 follow-up calls are removed with zero production Notification writes or live replacement events. |
| B5A2B-08 | Whole-remainder verification proves every owning mutation call, argument, order, result use, and unrelated UI branch unchanged except exact dead-binding cleanup. |
| B5A2B-09 | The temporary actor-name database read, interface, helper, projection, prop, mapping, sink, and activity-only `userName` path are completely absent. |
| B5A2B-10 | The dormant foundation has strict pure contracts, one synthetic event/template, injected atomic fake storage, and zero production registry entries, templates, events, adapters, transports, or callers. |
| B5A2B-11 | Cross-agency/subaccount, foreign actor, corrupt parent, duplicate, overflow, stale, deletion, rollback, forged context, unknown/extra input, and label-bound tests produce zero unauthorized side effects or logs. |
| B5A2B-12 | B5A2A historical evidence remains byte-exact and its adjusted verifier/tests continue protecting every unrelated B5A2A guarantee. |
| B5A2B-13 | Authority inventory has exactly 231 records and the other frozen counts, closes both legacy rows, adds exactly five declared internal rows, and preserves schema/taxonomies. |
| B5A2B-14 | Owned modules contain no raw console/error path and no email, selector, stored message, payload, provider/database error, stack, secret, or representative value enters logs or evidence. |
| B5A2B-15 | Fixed verifiers, focused/full tests, lint, typecheck, build, frozen install, inventory, diff, allowlist, protected-remainder, and bounded scans pass at the exact candidate and seals. |
| B5A2B-16 | No schema, package, provider, network, representative data/database, public route, deployment, re-theme, CRM/Odoo, Composio, agent runtime, or owning-domain event integration occurs. |
| B5A2B-17 | Architect, Verifier, and Acceptance approve the same gate, candidate, execution seal, and lifecycle seal with no more than two remediation rounds before B5A3 begins. |

## Stop conditions

- Exact discovery differs from two reader calls, 16 writer imports, 18 writer
  calls, or the bound temporary-name chain.
- Existing authorized notification UI requires a field outside the exact DTO
  or an unbounded/unstable read.
- A restricted actor cannot be filtered in the persistence predicate.
- Removing a follow-up call requires changing an authoritative mutation,
  public route, schema, package, provider, or later-domain behavior.
- A live activity event, concrete production template, adapter, transport, or
  mutation caller would be needed.
- Safe exactly-once behavior requires a schema/idempotency migration.
- Verification requires representative data, a database/provider/network,
  credentials, deployment, or taxonomy weakening.

Any stop returns B5A2B to Architect, Verifier, and Acceptance. It grants no
workaround, compatibility path, or scope expansion.

## Preserved holds and forbidden work

- Dependency audit remains `STALE_UNREVALIDATED`; advisories remain `UNKNOWN`;
  `CF-P1-AUDIT-FRESH-01` remains open.
- Permission `userId` migration remains `DESIGN_REQUIRED`.
- Representative database/provider evidence and public runtime remain blocked.
- Local, shared-development, staging, pilot, and production readiness remain
  `FAIL`.
- No package, lockfile, Prisma schema/migration, SQL, permission DDL, email or
  push delivery, live automation/event runtime, Stripe/provider expansion,
  public route, upload/media authority, funnel/publication authority,
  pipeline/ticket authority, credential, password manager, network service,
  deployment, release, re-theme, design/taste validation, CRM/Odoo, Composio,
  or agent-runtime work is authorized.
- No representative user, agency, subaccount, notification, or provider data
  may be read or written.
- B5A3-B5A8 remain blocked.

This gate cannot weaken or close another hold.

## Rollback

Implementation rollback is file-exact to parent
`7f236cbba1281c0bdaccbfa6770fcc0c128a4f80`:

- remove the three new `src/features/notifications/` modules, three new
  notification tests, and `scripts/verify-b5a2b-notification-boundary.ts`;
- restore every allowlisted existing source, test, verifier, inventory, and
  lock file exactly to the parent;
- retain accepted candidate evidence and execution records unchanged as
  immutable history, then append only the rollback commit and outcome to this
  issue's lifecycle metadata; and
- run both fixed verifiers, inventory verification, focused/full tests, lint,
  typecheck, build, frozen install, diff, and bounded scans after restoration.

No schema, data, provider, credential, public-route, package, or deployment
rollback is required because none may change.

## Status

`DONE`

## Lifecycle seal

- Original implementation-gate draft:
  `0d28d0dffa4e3a4fa078beaf6cc5881f891a7211`.
- Accepted remediated implementation gate:
  `1b3b36256629d3aaae567ffb66a351ece036359e`.
- Gate Architect token: `APPROVE_B5A2B_IMPLEMENTATION_GATE`.
- Gate Verifier token: `PASS_B5A2B_IMPLEMENTATION_GATE`.
- Gate Acceptance token: `ACCEPT_B5A2B_IMPLEMENTATION_GATE_AND_PUSH`.
- Implementation authoring token: `GO_B5A2B_IMPLEMENTATION`.
- Original held implementation candidate:
  `df9d73353f52bca948f5e718bf7dd7dd5998ab0f`.
- Implementation-remediation-one candidate:
  `c78cfaeff36b8f6fd0fc260d5197f3ecf197e00e`.
- Implementation-remediation-two final candidate:
  `d0f6539dce86dbf68eadf9457893c0b38bd5bad1`.
- First implementation hold: `HOLD_B5A2B_IMPLEMENTATION_CANDIDATE`.
- First remediation token: `GO_B5A2B_IMPLEMENTATION_REMEDIATION_1`.
- Second implementation hold: `HOLD_B5A2B_REMEDIATION_CANDIDATE`.
- Final remediation token: `GO_B5A2B_IMPLEMENTATION_REMEDIATION_2`.
- Implementation Architect token:
  `APPROVE_B5A2B_REMEDIATION_CANDIDATE`.
- Implementation Verifier token: `PASS_B5A2B_REMEDIATION_CANDIDATE`.
- Implementation Acceptance token: `ACCEPT_B5A2B_REMEDIATION_CANDIDATE`.
- Evidence/execution-seal authoring token:
  `GO_B5A2B_EVIDENCE_EXECUTION_SEAL_AUTHORING`.
- Held execution-seal candidate:
  `c2b3ddd7676b9bd33f1f3fa116bbb79a5642ba87`.
- Corrected execution seal:
  `1f44d6bb98037aad75a68d9c7e0cc511b428ba72`.
- Execution-seal hold: `HOLD_B5A2B_EXECUTION_SEAL`.
- Evidence-correction token:
  `GO_B5A2B_EXECUTION_SEAL_EVIDENCE_CORRECTION`.
- Execution-seal Architect token: `APPROVE_B5A2B_EXECUTION_SEAL`.
- Execution-seal Verifier token: `PASS_B5A2B_EXECUTION_SEAL`.
- Execution-seal Acceptance token: `ACCEPT_B5A2B_EXECUTION_SEAL`.
- Lifecycle authoring token: `GO_B5A2B_LIFECYCLE_SEAL_AUTHORING`.
- Gate remediation used: 1 of 2 rounds under
  `GO_B5A2B_GATE_REMEDIATION_1`.
- Implementation remediation used: 2 of 2 rounds. The implementation
  remediation allowance is exhausted.
- The four-value canonical-hash correction is a separate evidence-only event,
  not a third implementation remediation round.
- The dormant activity foundation remains `DORMANT_BLOCKED` with zero
  production registry entries, templates, events, adapters, callers, or
  writes.
- This transition closes only B5A2B notification visibility, writer
  retirement, compatibility removal, and its dormant foundation. B5A3-B5A8
  remain blocked. Dependency audit remains `STALE_UNREVALIDATED`, advisories
  remain `UNKNOWN`, and `CF-P1-AUDIT-FRESH-01` remains open. Permission
  migration remains `DESIGN_REQUIRED`. Representative database/provider and
  public-runtime evidence remain blocked. Local, shared-development, staging,
  pilot, and production readiness remain `FAIL`. Re-theme/taste validation,
  CRM/Odoo, Composio, agent-runtime, credentials, deployment, and release
  remain blocked pending their own exact gates.

## Execution gate

`HISTORICAL_EXECUTION_ONLY`; any new B5A2B work requires a new exact gate.
