# CF-P1-B5A2A — Actor-safe agency projections

## Objective

Replace broad actor/agency ORM graphs and page-level database reads with
purpose-specific, actor-derived projections for entry routing, sidebars,
settings, all-subaccounts, default-subaccount routing, and ticket assignees.

This work item began as the final documentation-only B5A2A implementation
gate. Its completed gate, implementation, remediation, review, and execution
chain is preserved below as immutable lifecycle history.

## Immutable authority

- Accepted B5A2 intake:
  `90b0cdb0855a3ee3971567b76242d59c7b2b26d5`.
- Intake token: `ACCEPT_B5A2_INTAKE_AND_PUSH`.
- Accepted legacy-name compatibility addendum:
  `33deadd6c2127099823508e9ab3c74b544d1f0c3`.
- Compatibility token:
  `ACCEPT_B5A2A_COMPATIBILITY_ADDENDUM_AND_PUSH`.
- Accepted agency-ID prop type amendment:
  `744163194cb4ef9d3bd10f1592dd91504009c4f4`.
- Agency-ID token:
  `ACCEPT_B5A2A_AGENCY_ID_PROP_TYPE_AMENDMENT_AND_PUSH`.
- Accepted subaccount-details boundary amendment:
  `32ffcc27a78eadf6344cc3d262e72bc260a02e2e`.
- Boundary token:
  `ACCEPT_B5A2A_SUBACCOUNT_DETAILS_BOUNDARY_AMENDMENT_AND_PUSH`.
- Gate-authoring token: `GO_B5A2A_FINAL_IMPLEMENTATION_GATE_AUTHORING`.
- Branch: `codex/crewframe-foundation`.
- Maximum gate or implementation remediation rounds: 2 each.
- Target: local repository, fixed synthetic adapters, and offline checks only.

## Gate state

- Parent B5A: `READY`.
- B5A1: `DONE`.
- B5A2 intake and three amendments: `ACCEPTED`.
- B5A2A gate and implementation: `DONE`.
- B5A2A implementation gate: `HISTORICAL_EXECUTION_ONLY`.
- B5A2B and B5A3-B5A8: `BLOCKED`.

No new or downstream production authority is inherited from this completed
work item, its intake, or its amendments.

## Exact 14-record binding

These are all and only the B5A1 records owned by B5A2A. Source hashes are the
canonical B5A1 hashes. The implementation must produce a closed old-to-new
ledger for every row; none may disappear without an explicit removal or
replacement disposition.

| Exact `surfaceId` | Source hash | Required closure |
| --- | --- | --- |
| `internal-only:src/app/(main)/agency/[agencyId]/settings/page.tsx#$db` | `sha256:6325f8b04cfc0fa56d8e85bd5707a425480f6e0be4a79343ce1841ebde6e0d48` | Remove direct database import/query; replace with agency-settings projection. |
| `internal-only:src/app/(main)/subaccount/[subaccountId]/settings/page.tsx#$db` | `sha256:aa7de29c77676c90e1284f8ef07739c20234778a2d6439031018181377822944` | Remove direct database import/query; replace with exact tenant-settings projection. |
| `internal-only:src/lib/types.ts#__getUsersWithAgencySubAccountPermissionsSidebarOptions` | `sha256:57ee01f9500436294b413fda64c86b45693f4780bdb543897b5d4272cbdfcd74` | Remove database-backed type helper. |
| `internal-only:src/lib/types.ts#$db` | `sha256:57ee01f9500436294b413fda64c86b45693f4780bdb543897b5d4272cbdfcd74` | Remove `db` import from the type module. |
| `layout loader:src/app/(main)/agency/[agencyId]/layout.tsx#default` | `sha256:60e507efcdb0ffc6df440afdd31d81ab48aaea15a36ece960ca5100525d63525` | Retain byte-exact; its Sidebar dependency becomes actor-safe. |
| `layout loader:src/app/(main)/subaccount/[subaccountId]/layout.tsx#default` | `sha256:d12f84b0abbee14d4fd62013cc765941381287b810b7e2c5e8974b9cdd8db08d` | Retain byte-exact; its Sidebar dependency becomes actor-safe. |
| `page loader:src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx#default` | `sha256:96ab560857c70226dab4a32e54b932dbd995ac12b7511aa2ef694842df863c54` | Replace broad graph with operator-scoped projection. |
| `page loader:src/app/(main)/agency/[agencyId]/settings/page.tsx#default` | `sha256:6325f8b04cfc0fa56d8e85bd5707a425480f6e0be4a79343ce1841ebde6e0d48` | Use exact agency-settings projection. |
| `page loader:src/app/(main)/agency/page.tsx#default` | `sha256:e2cdf414c3bf1c82f0a8359b5f9cabd51b3d7a53dc1d7ee9a5f1c4ec8ea7f1e8` | Use bounded entry outcome; preserve account-entry call and redirects. |
| `page loader:src/app/(main)/subaccount/[subaccountId]/settings/page.tsx#default` | `sha256:aa7de29c77676c90e1284f8ef07739c20234778a2d6439031018181377822944` | Use exact tenant-settings projection. |
| `page loader:src/app/(main)/subaccount/page.tsx#default` | `sha256:03cc81898f7eea3e7da544e19976849825c8d4602ba530f0f06f5e53831aa95b` | Use deterministic default-subaccount redirect projection. |
| `provider callback:src/app/(main)/agency/page.tsx#$provider:clerk.currentUser` | `sha256:e2cdf414c3bf1c82f0a8359b5f9cabd51b3d7a53dc1d7ee9a5f1c4ec8ea7f1e8` | Retain only for the bounded onboarding email display. |
| `server action:src/lib/queries.ts#getAuthUserDetails` | `sha256:9629a2bc0d55baafc00f6d0b80d7327ac37719fc2f367a0cdab5573456b0c4c2` | Remove export and every value/type consumer; replace with purpose projections. |
| `server action:src/lib/queries.ts#getSubAccountTeamMembers` | `sha256:9629a2bc0d55baafc00f6d0b80d7327ac37719fc2f367a0cdab5573456b0c4c2` | Remove export; replace with exact tenant-scoped assignee action. |

The two B5A2B records in `src/lib/queries.ts` remain assigned to B5A2B. Their
file hash may change mechanically when the two B5A2A declarations are removed,
but their bound AST declarations and behavior cannot change.

## Closed architecture

The implementation adds one feature boundary:

- `projection-service.ts`: pure DTOs, finite inputs, store interfaces,
  cardinality checks, role decisions, sorting, and explicit mapping;
- `server-projection-service.ts`: `server-only` identity/context and Prisma
  adapter using explicit `select` clauses and conjunctive tenant predicates;
  and
- `actions.ts`: a `use server` transport exporting only the ticket-assignee
  action required by the existing client component.

Server pages and the Sidebar server component call the server projection
service directly. They do not call a generic client-visible action. No method
returns a Prisma model, accepts an actor/role/email/agency object from a caller,
or exposes a catch-all actor/agency graph.

The only client-callable B5A2A transport accepts one bounded subaccount ID,
resolves immutable provider identity and tenant context server-side, and
returns only ticket-assignee options.

## Exact projection APIs and DTOs

Implementation names may differ only if the exact gate reviewers approve an
equivalent one-to-one name map before source work. The public shape and fields
cannot differ.

### Entry outcome

`getAccountEntryProjection()` returns exactly one discriminated union:

- `ROUTE`: `kind`, `role`, and non-null `agencyId`;
- `ONBOARDING`: `kind` only.

The `/agency` page may separately retain its existing server-side
`currentUser()` call and pass only the provider email to the existing form.
That provider email never enters the projection service or an authority
predicate. An authenticated no-local-actor subject and an exact
`AGENCY_OWNER` with null agency may receive `ONBOARDING`. Anonymous subjects
and every other invalid actor state are denied. No tenant query occurs for an
onboarding result.

### Default subaccount redirect

`getDefaultSubaccountRedirectProjection()` returns exactly
`Readonly<{ subaccountId: string }>` or the existing unauthorized outcome.
It returns no User, Agency, Permission, or SubAccount object.

### Sidebar DTOs

Shared exact shapes:

- agency navigation: `id`, `name`, `address`, `agencyLogo`, `whiteLabel`;
- subaccount navigation: `id`, `name`, `address`, `subAccountLogo`;
- sidebar option: `id`, `name`, `icon`, `link`;
- actor navigation: `role` only; and
- temporary top-level `legacyActivityActorName?: string` under the accepted
  addendum, never inside a generic actor DTO.

`getAgencySidebarProjection(agencyId)` returns `kind: 'agency'`, actor role,
agency navigation, agency sidebar options, and deterministic agency-owned
subaccount navigation. The temporary name exists only for owner/admin
create-subaccount capability.

`getSubaccountSidebarProjection(subaccountId)` returns `kind: 'subaccount'`,
actor role, agency navigation, exact current subaccount navigation and sidebar
options, and switchable subaccount navigation. Owners/admins receive
agency-owned subaccounts; other actors receive only exactly permitted
same-agency subaccounts. The temporary name is absent for all non-owner/admin
actors.

No actor ID is serialized by a sidebar projection because the accepted dead
`userId` removal leaves no consumer.

### All-subaccounts DTO

`getAgencySubaccountsProjection(agencyId)` returns:

- agency reference: `Readonly<{ id: string }>`;
- deterministic list of `id`, `name`, `address`, `subAccountLogo`; and
- optional `legacyActivityActorName` only for the already authorized
  owner/admin create capability.

It returns no actor ID, permission graph, provider/billing/customer field,
sidebar graph, notification, contact, funnel, pipeline, ticket, or other
nested resource.

### Settings DTOs

Agency settings returns exactly:

- agency profile: `id`, `name`, `agencyLogo`, `companyEmail`, `companyPhone`,
  `whiteLabel`, `address`, `city`, `zipCode`, `state`, `country`, `goal`;
- actor profile: `id`, `name`, `avatarUrl`, `email`, `role`; and
- subaccount selectors: `id`, `name`.

Subaccount settings returns exactly:

- agency reference: `Readonly<{ id: string }>`;
- subaccount details: the accepted exact readonly ten fields `id`, `name`,
  `companyEmail`, `companyPhone`, `address`, `city`, `zipCode`, `state`,
  `country`, `subAccountLogo`;
- actor profile: `id`, `name`, `avatarUrl`, `email`, `role`; and
- visible subaccount selectors: `id`, `name`.

`AgencyDetails.data` becomes an exact readonly 12-field purpose type with
those agency-profile fields optional only to support the existing onboarding
prefill. It cannot reference `Agency` or another Prisma model.

`SubAccountDetails` receives the accepted exact ten-field optional details
DTO, exact ID-only agency reference, and legacy compatibility name. Its unused
`userId` prop is removed from the component and all three callers.

### Ticket assignee DTO

`listTicketAssigneeOptions(subaccountId)` returns a deterministic readonly
array containing only `id`, `name`, and `avatarUrl`. Every row is a
`SUBACCOUNT_USER` in the actor's agency with exactly one active permission for
the requested subaccount. Guests are excluded. `TicketForm` stores this exact
type rather than `User[]`.

## Persistence and cardinality predicates

Every selector is validated as a trimmed non-empty string with a maximum of
128 characters before persistence access. UUID validation is not introduced
because existing identifiers include provider-issued subjects; purpose-level
schemas may be stricter only where the current schema guarantees UUIDs.

| Operation | Required actor and persistence predicate | Cardinality and order |
| --- | --- | --- |
| Entry | provider subject → `User.id = subject` | Zero local rows permits only bounded onboarding; one valid row routes; ambiguity/conflict fails. |
| Default redirect | exact actor with non-null agency; `Permissions.User.id = actor.id AND User.agencyId = actor.agencyId AND access = true AND SubAccount.agencyId = actor.agencyId` | Duplicate active rows for one subaccount fail; distinct rows order `subAccountId ASC`; zero denies; return first ID only. |
| Agency sidebar | `getAgencyContext(requestedAgencyId)` plus agency-operator policy; `Agency.id = context.agencyId`; `SubAccount.agencyId = context.agencyId` | Exact agency required; options order `createdAt ASC, id ASC`; subaccounts order `name ASC, id ASC`. |
| Subaccount sidebar | `getTenantContext(requestedSubaccountId)`; exact `SubAccount.id = context.subaccountId AND agencyId = context.agencyId` | Exact current tenant required; permitted switcher rows require same-agency active permissions and reject duplicate subaccount permissions. |
| All-subaccounts | agency-operator context; `Agency.id = context.agencyId`; every row `SubAccount.agencyId = context.agencyId` | Exact agency; deterministic `name ASC, id ASC`. |
| Agency settings | agency-operator context; actor `User.id = context.actor.id AND agencyId = context.agencyId`; agency `id = context.agencyId`; subaccounts `agencyId = context.agencyId` | Each singular record exactly one; deterministic selectors. |
| Subaccount settings | tenant context; actor `User.id = context.actor.id AND agencyId = context.agencyId`; subaccount `id = context.subaccountId AND agencyId = context.agencyId`; visible selectors use role or active same-agency permission | Each singular record exactly one; duplicate permission fails; deterministic selectors. |
| Ticket assignees | tenant context; permission `subAccountId = context.subaccountId AND access = true`; related SubAccount `agencyId = context.agencyId`; related User `agencyId = context.agencyId AND role = SUBACCOUNT_USER` | Exactly one active permission per returned user; duplicate user rows fail; order `name ASC, id ASC`. |

Mapping is allowlist-only. ORM `include`, `select: true` for a relation, object
spread from a record, JSON round-trip, or returning an adapter record directly
is forbidden.

## Denial and stale-state contract

- Use the existing finite `AccessError` codes; do not expose whether a foreign
  agency, subaccount, permission, or user exists.
- Anonymous entry redirects through the accepted account-entry behavior;
  private projection transports otherwise deny before persistence.
- Missing, deleted, orphaned, cross-agency, wrong-parent, null-agency,
  duplicate active permission, and ambiguous actor/record cases fail closed.
- A denied projection returns no partial DTO and creates zero database writes,
  notifications, logs, revalidations, provider calls beyond the accepted
  identity lookup, or other side effects.
- No raw database/provider error, email, actor/tenant ID, request value,
  payload, or stack trace is logged or returned.
- Read snapshots do not authorize a later write. Every existing mutation keeps
  its independent actor/ownership checks.

## UI and type-boundary changes

- Sidebar and `MenuOptions` use exact projection types; remove `any` and broad
  Prisma Agency/SubAccount/sidebar-option props.
- `MenuOptions` and `CreateSubaccountButton` construct fresh
  `agencyDetails={{ id: projection.agency.id }}` objects with no spread or
  cast and preserve the two accepted legacy-name mappings.
- Subaccount settings constructs the third fresh one-key agency reference and
  the exact ten-field details DTO.
- Remove dead `id` props and arguments from `MenuOptions` and
  `CreateSubaccountButton`; neither currently reads the value. The Sidebar
  still receives its route ID because it selects the requested projection.
- Remove the all-subaccounts `SubAccount` map annotation and consume the exact
  projected list.
- Narrow `AgencyDetails.data` to its exact purpose type and `TicketForm`
  assignee state to the exact three-field option.
- Do not introduce a type assertion, `any`, `unknown` double cast, non-null
  evasion, index signature, broad generic, Prisma-model alias, or wrapper.

No user-facing copy, layout, styling, feature, mutation, redirect destination,
toast, modal, notification, or activity behavior changes in B5A2A.

## Frozen invitation and notification boundaries

`verifyAndAcceptInvitation()` remains imported and called exactly once in each
of the two entry pages and two scoped layouts. Its call-expression AST digest
remains:

`sha256:da8dffbc20a8b2d7ec3c0d436fb50ab77b03b39d30eeaa528d2920f8d3647f0a`

`src/features/accounts/actions.ts` remains byte-exact at:

`sha256:e3804c4486b39ae11af2416e3bf7c125d5ad1e702fbd6715b16084ecadda598d`

The two scoped layouts remain byte-exact at their 14-record hashes above.

The following normalized AST hashes remain exact:

| Frozen behavior | SHA-256 digest |
| --- | --- |
| `getNotificationAndUser` declaration | `sha256:cfe7c297af8f19b6c0f1a72f078acf28f13a90a009b498d8b0464b3b59931a83` |
| `saveActivityLogsNotification` declaration | `sha256:5a5a1ccfbaa03dce8f4db75ed5a79a2cce43972be611f972e5bdba1e002c8f1c` |
| `SubAccountDetails` query import | `sha256:4e104e2d1d4f7ede1400313531afd4f8a2befb70cd0db4860e89a7a9a827656f` |
| `SubAccountDetails.onSubmit` | `sha256:713140c5b26293b14b250533d726f46ef63ac7753571b169395b2b886a9b0fa8` |
| `SubAccountDetails` activity call | `sha256:183d9c7ec7e2adad335117e89d1b75c4d788e6d9cdb86fb2429148997e65854f` |
| `SubAccountDetails` activity description | `sha256:6950341cf109439e1a01adb3b22f57d82cc5759da6f9d91bbf677b5222ae6806` |
| `AgencyDetails` activity call | `sha256:87b4e688861a7b23c425d0cf64862691b7db49a05ff8ae211f76e1b4d4501d9f` |
| `AgencyDetails` activity description | `sha256:2d1499fb1f8a38292e42849f07ebe4a890bcccbfef0643e193054453ca76944f` |
| `TicketForm.onSubmit` | `sha256:9adf0c9950dde28a613d8416b576a1b69780534474819d6bf83fd58ec9f27f46` |
| `TicketForm` activity call | `sha256:840ab41e509d43bc8bd53e83d37028b01adcc0e2011934e378480d690484dfec` |
| `TicketForm` activity description | `sha256:b3bd346667ff6f8f5016f81364641fd20b9bb43eea195b6039f67884cb2adca5` |

The five removed `userId` nodes from the accepted boundary amendment must be
absent; their exact pre-change hashes remain bound there. No other
notification/activity import, call, argument, message, fallback, persistence
behavior, or expectation may change.

## Transitive caller closure

The implementation must deterministically prove:

- zero imports or type/value references to `getAuthUserDetails` remain;
- zero imports or calls to `getSubAccountTeamMembers` remain;
- `src/lib/types.ts` has no database import or database-backed type helper;
- both settings pages have no direct database import;
- only the three exact SubAccountDetails JSX consumers exist;
- only the two exact legacy-name compatibility mappings exist;
- exactly four accepted invitation/provisioning calls remain; and
- the only new client-callable surface is the exact assignee action.

At the immutable parent, additional caller hashes are:

| Path | Canonical source hash |
| --- | --- |
| `src/components/sidebar/index.tsx` | `sha256:3e173c19a45cbb587d1a84740d30c8a839a537fa5461e88704203736b9a78543` |
| `src/components/sidebar/menu-options.tsx` | `sha256:6d11524df70dcdcd654cb0f53f61559903c3157b16cd1046c0304cac00b5bddc` |
| `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx` | `sha256:93e27857305cfb079a358e262520e0264a5711130deb6cde46428463bb06a388` |
| `src/components/forms/subaccount-details.tsx` | `sha256:912f125c0c484642a089f3df5f493d889056e8828b86ce89cae45573161cc2fd` |
| `src/components/forms/agency-details.tsx` | `sha256:247a6f37ad9c49fe858be166b1955d2f34c203d1dddc97068aa5839868056642` |
| `src/components/forms/ticket-form.tsx` | `sha256:c6cbeafff2fda8ab1152c4a9e6a5f28d2dfac092b7aaa0b182edebed0150e217` |

New, removed, renamed, duplicate, or hash-drifted callers fail the fixed-input
verification unless the exact candidate ledger explains the allowed change.

## Whole-remainder protection for writable legacy files

Three writable legacy files contain behavior outside B5A2A. The verifier must
parse the accepted parent and candidate with the repository TypeScript version,
normalize line endings, print the normalized AST with LF newlines, remove or
type-erase only the exact allowlisted nodes below, and compare the complete
remainder digest. Statement reordering, import drift, another declaration
change, or an unrecognized AST difference fails.

| File | Sole ignored/normalized difference | Required identical remainder SHA-256 |
| --- | --- | --- |
| `src/lib/queries.ts` | Remove only the complete top-level declarations named `getAuthUserDetails` and `getSubAccountTeamMembers` from both parent and candidate before printing. | `sha256:a8abbbcbb72826980143b1da92bb7562f3e0033af7b9333719f0cc9aed73fab7` |
| `src/lib/types.ts` | Remove only the `./db` import, the `getAuthUserDetails` import specifier, `__getUsersWithAgencySubAccountPermissionsSidebarOptions`, and the two type aliases `AuthUserWithAgencySigebarOptionsSubAccounts` and `UsersWithAgencySubAccountPermissionsSidebarOptions` from both trees before printing. | `sha256:cf5eaa285a4d8486056828203dc822e9a0d41eec017eed1dc73c1d3549449252` |
| `src/components/forms/agency-details.tsx` | Remove only the `Agency` import specifier and normalize the `Props.data` type node to one `unknown` sentinel in both trees before printing; the candidate must contain the exact 12-field purpose type before normalization. | `sha256:1679d010911a9fb351bbd27dc7df85776b77f0e2fb56ee3787f0350210363d0e` |

The algorithm is versioned in `scripts/verify-b5a2a-projections.ts`; it cannot
accept file paths, ignore lists, hashes, or symbols from arguments or the
environment. Tests mutate fixed temporary copies to prove that drift in every
non-ignored statement fails.

In addition to whole-remainder equivalence, the mutation-bearing
`AgencyDetails` nodes remain individually bound:

| Frozen handler or effect | Normalized AST SHA-256 |
| --- | --- |
| `handleSubmit` declaration | `sha256:d1d2b24c34c785d578963f849d3f18b9a3b604ad2bc50469a6cf4ca1917059f0` |
| `provisionAgencyOwner()` call | `sha256:4f9d92776f9917c78448551c93fcb573a085df8b58e7019a76f6c21253f26f40` |
| `upsertAgency(...)` call | `sha256:2b88b82e273f55edec0fa47e7c8a41d06fbd6bbf99fd721ec48dfa20d3b68e5a` |
| `/api/stripe/create-customer` fetch call | `sha256:a66562ba4bb9e88cc67bb819554a6f4f620daec14ff343405dc370dc82cce882` |
| `handleDeleteAgency` declaration | `sha256:3a24b21d6de9fff1bb00c469f1eafcfe7e6df9239f2fb0402a8d3afa83995fe1` |
| `deleteAgency(...)` call | `sha256:fe642117eb8bf1d4b603994ad1009be4f1f52acb81cb014822a9359d662bbe73` |
| Goal `onValueChange` JSX attribute | `sha256:2b8880338472392bec4e6fc37d9749342b22923001a6d0db63c0ec17841093f2` |
| `updateAgencyGoal(...)` call | `sha256:5d603ec92586286702feb900ffcc2e0f12e824cb2d4d7e75b43da19251fdfd8b` |

Focused tests assert these hashes and the existing provisioning, agency
upsert, Stripe-customer request, delete, goal-update, toast, refresh, and error
paths. No type-only change can mask behavior drift.

## Concrete file allowlist

After exact implementation approval, B5A2A may add or modify only these files.

### Production feature boundary

- `src/features/agency-projections/projection-service.ts` (new)
- `src/features/agency-projections/server-projection-service.ts` (new)
- `src/features/agency-projections/actions.ts` (new)

### Exact transports and consumers

- `src/app/(main)/agency/page.tsx`
- `src/app/(main)/subaccount/page.tsx`
- `src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx`
- `src/app/(main)/agency/[agencyId]/settings/page.tsx`
- `src/app/(main)/subaccount/[subaccountId]/settings/page.tsx`
- `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx`
- `src/components/sidebar/index.tsx`
- `src/components/sidebar/menu-options.tsx`
- `src/components/forms/agency-details.tsx` (only the exact `Agency` import
  removal and `data` prop type narrowing; normalized remainder is immutable)
- `src/components/forms/subaccount-details.tsx`
- `src/components/forms/ticket-form.tsx`
- `src/lib/queries.ts` (only the exact two owned declaration removals;
  normalized remainder is immutable)
- `src/lib/types.ts` (only the exact broad helper/import/type removals;
  normalized remainder is immutable)

### Fixed verification and inventory reconciliation

- `tests/agency-projections/projection-service.test.ts` (new)
- `tests/agency-projections/projection-surface.test.ts` (new)
- `scripts/verify-b5a2a-projections.ts` (new)
- `scripts/agency-authority-inventory-lib.ts` (only exact new-symbol action,
  ownership, disposition, and protected-hash classification; discovery cannot
  be weakened)
- `tests/authority-inventory/agency-authority-inventory.test.ts` (only exact
  B5A2A source/removal/replacement drift assertions if required)
- `docs/security/agency-authority/inventory.json`
- `docs/security/agency-authority/inventory.lock.json`

The inventory schema and finite taxonomies cannot change. New accepted records
use existing `account:entry`, `agency:view`, `subaccount:view`, `team:read`, or
`INTERNAL_ONLY` actions and `ACCEPTED_RETAIN` disposition as appropriate.

### Evidence and lifecycle

- `docs/evidence/CF-P1-B5A2A-candidate-verification.json` (new)
- `docs/execution/CF-P1-B5A2A-actor-safe-projections.md` (new)
- this work item for later exact lifecycle metadata only

Unlisted production, test, tooling, inventory, documentation, package, schema,
configuration, public, provider, and deployment files are forbidden. In
particular, both scoped layouts and `src/features/accounts/actions.ts` are
verification-only frozen inputs, not writable files.

## Required focused tests

### Identity and entry

- anonymous, provider-subject mismatch, no local actor, exact owner with null
  agency, exact provisioned owner/admin/user/guest, invalid role/agency state,
  and tenant-free onboarding;
- no tenant query or tenant field for onboarding; provider email remains form
  prefill only; and
- all existing authorized redirects and exactly four account-entry calls.

### Agency and tenant projections

- owner/admin agency success, non-operator denial, cross-agency route
  substitution, missing/deleted agency, and zero partial result;
- same-agency exact tenant, same-agency other tenant, cross-agency tenant,
  wrong parent, missing/deleted/orphaned tenant, guest/user permission,
  owner/admin privilege, false permission, duplicate permission, and deletion
  during read;
- exact field snapshots and explicit rejection of every excluded User, Agency,
  SubAccount, Permission, connected-account, customer, notification, contact,
  funnel, pipeline, ticket, and nested-relation field; and
- deterministic option/subaccount ordering with stable ID tie-breakers.

### Default redirect and assignees

- zero, one, multiple-distinct, duplicate-same-subaccount, false/revoked,
  cross-agency, missing, deleted, and orphaned permissions;
- `subAccountId ASC` selection and ID-only redirect output;
- assignee exact tenant, `SUBACCOUNT_USER` only, guest exclusion, foreign user,
  foreign permission, duplicate active permission, stale/deleted user or
  subaccount, and deterministic `name ASC, id ASC`; and
- zero full User models, emails, roles, agencies, or permission graphs in
  assignee output.

### Type, source, and compatibility drift

- exact 12-field AgencyDetails purpose type, ten-field SubAccountDetails DTO,
  three-field assignee option, sidebar DTOs, and all excluded-field failures;
- all accepted ID-only prop, dead-userId, and legacy-name role/sink tests from
  the three amendments;
- source mutations proving rejection of a broad import, `any`, cast, spread,
  wrapper, direct DB page/type query, retired export/caller, fourth details
  consumer, third name sink, fifth account-entry call, or new client action;
- whole-remainder mutation fixtures for `queries.ts`, `types.ts`, and
  `agency-details.tsx`, including drift in every non-B5A2A server export and in
  the provisioning, upsert, Stripe, delete, and goal-update paths;
- all frozen file/node hashes and notification zero-change assertions; and
- inventory reconciliation for removed, replaced, retained, and new surfaces.

Tests use pure in-memory adapters and fixed synthetic identifiers. They do not
import application server modules requiring Next/Clerk runtime, connect to a
database, inspect environment values, or call a network/provider.

## Verification and bounded evidence

Required candidate commands, all at the exact candidate SHA:

1. `bun scripts/verify-b5a2a-projections.ts`
2. `bun scripts/verify-agency-authority-inventory.ts`
3. focused agency-projection and authority-inventory tests
4. full `bun test`
5. `bun run lint`
6. `bun run typecheck`
7. `bun run build`
8. frozen offline dependency continuity using the already accepted lockfile
9. `git diff --check` and exact file-allowlist comparison
10. bounded secret/PII/log/provider/schema/package/public/deployment scans

Evidence records exact parent/candidate SHAs, 14-row closure ledger, old/new
surface counts and hashes, projection/denial/cardinality/test counts, frozen
node and whole-remainder hashes, command and exit status, inventory/lock hash,
and explicit zero-use statements for network, provider, representative
database/data, credentials, schema, packages, public routes, notification
behavior, and deployment.

Evidence emits no source text, actor names, emails, runtime IDs, payloads,
provider/database errors, environment values, secrets, credentials, stack
traces, or representative data.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| B5A2A-01 | All 14 bound B5A1 records have one explicit removed, replaced, or retained closure and no other B5A2 record is changed semantically. |
| B5A2A-02 | Every projection derives immutable server identity and actor/tenant context; caller identity, role, email, UI state, and layout reachability grant no authority. |
| B5A2A-03 | Entry, redirect, sidebar, all-subaccounts, settings, and assignee DTOs contain exactly their allowlisted fields and no broad Prisma graph. |
| B5A2A-04 | Every database read contains the operation-appropriate actor-derived predicate in the persistence table; tenant reads additionally contain exact actor-agency and requested-subaccount predicates, with finite cardinality, duplicate, missing, deletion, and deterministic-order behavior. |
| B5A2A-05 | Broad legacy exports, their callers, page/type database imports, broad model props, `any`, casts, spreads, wrappers, and dead ID props are absent. |
| B5A2A-06 | Authorized entry, sidebar, settings, all-subaccounts, create-subaccount, and ticket-assignee UI behavior remains stable under exact synthetic fixtures. |
| B5A2A-07 | Four invitation/provisioning calls, accepted account actions, two scoped layouts, all notification/activity runtime nodes, all AgencyDetails mutation handlers, and all three writable-legacy-file remainder digests remain exact. |
| B5A2A-08 | Cross-agency, cross-subaccount, wrong-parent, broad-projection, duplicate permission, stale/deleted, onboarding, guest, and confused-deputy tests pass with zero unauthorized side effects. |
| B5A2A-09 | The temporary name is owner/admin-only, reaches exactly two frozen legacy sinks, grants no authority, and remains marked for mandatory B5A2B removal. |
| B5A2A-10 | The exact agency-ID prop, ten-field details DTO, three consumers, five dead-userId removals, and all amendment AST hashes reconcile. |
| B5A2A-11 | Authority inventory and fixed source discovery reconcile all removed/replacement/new surfaces without schema/taxonomy weakening. |
| B5A2A-12 | Focused/full tests, lint, typecheck, build, frozen offline install, diff-check, allowlist, and bounded scans pass at the exact candidate and seals. |
| B5A2A-13 | Architect, Verifier, and Acceptance approve the same candidate, execution seal, and lifecycle seal before B5A2B gate authoring begins. |

## Stop conditions

- A consumer needs a field outside the accepted projection or three
  amendments.
- A direct caller or persistence surface cannot be deterministically closed.
- Safe behavior would require changing account-entry, notification/activity,
  another mutation, a provider, a public route, permission schema, or later
  B5A child.
- Exact permission cardinality cannot be proven without the blocked `userId`
  migration.
- A test requires representative data, database/provider/network access,
  credentials, deployment, or taxonomy weakening.
- A full ORM object, cast, wrapper, spread, `any`, implicit layout authority,
  in-memory authorization filter, or caller-trusted owner would remain.

Any stop returns B5A2A to Architect, Verifier, and Acceptance. It grants no
workaround or scope expansion.

## Forbidden work and preserved holds

- No B5A2B notification reader/writer retirement or live event work.
- No B5A3-B5A8 implementation.
- No package, lockfile, dependency, Prisma schema/migration, SQL, permission
  DDL, email/push, provider expansion, public route, upload/media, funnel,
  pipeline/ticket mutation, automation, credential, password manager,
  representative database/data, network, deployment, release, re-theme,
  design/taste validation, CRM/Odoo, Composio, or agent-runtime work.
- Dependency audit remains `STALE_UNREVALIDATED`; advisories remain `UNKNOWN`;
  `CF-P1-AUDIT-FRESH-01` remains open.
- Permission `userId` migration remains `DESIGN_REQUIRED`.
- Public runtime and representative provider/database evidence remain blocked.
- Local, shared-development, staging, pilot, and production readiness remain
  `FAIL`.

This gate cannot weaken or close another hold.

## Rollback

Implementation rollback is closed over the complete allowlist:

- remove the three new `src/features/agency-projections/` files;
- remove both new `tests/agency-projections/` files and
  `scripts/verify-b5a2a-projections.ts`;
- restore `src/app/(main)/agency/page.tsx`,
  `src/app/(main)/subaccount/page.tsx`,
  `src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx`,
  `src/app/(main)/agency/[agencyId]/settings/page.tsx`,
  `src/app/(main)/subaccount/[subaccountId]/settings/page.tsx`,
  `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx`,
  `src/components/sidebar/index.tsx`,
  `src/components/sidebar/menu-options.tsx`,
  `src/components/forms/agency-details.tsx`,
  `src/components/forms/subaccount-details.tsx`,
  `src/components/forms/ticket-form.tsx`, `src/lib/queries.ts`, and
  `src/lib/types.ts` exactly to parent
  `32ffcc27a78eadf6344cc3d262e72bc260a02e2e`;
- restore `scripts/agency-authority-inventory-lib.ts` and
  `tests/authority-inventory/agency-authority-inventory.test.ts` exactly to
  that parent;
- restore `docs/security/agency-authority/inventory.json` and
  `inventory.lock.json` exactly to that parent; and
- retain the committed candidate evidence and execution record unchanged as
  immutable historical evidence, then append the rollback commit and outcome
  only to this issue's lifecycle metadata.

The restored full test and inventory suites must pass after rollback. Frozen
layouts, account actions, notification/activity behavior, schema, packages,
public routes, providers, data, and deployment require no rollback because
they do not change.

## Status

`DONE`

## Lifecycle seal

- Original implementation-gate draft:
  `c0f684026c21f59729b340f495533020c3584cd2`.
- Accepted final implementation gate:
  `bbe5ec82a8184c21fc0d09f767891c5dc7f08534`.
- Gate Architect token: `APPROVE_B5A2A_IMPLEMENTATION_GATE`.
- Gate Verifier token: `PASS_B5A2A_IMPLEMENTATION_GATE`.
- Gate Acceptance token: `ACCEPT_B5A2A_IMPLEMENTATION_GATE_AND_PUSH`.
- Original held implementation candidate:
  `30917ecfec561ed2beb1fc1929c9c5f809739aaf`.
- Remediation-round-one production implementation:
  `8482550f03ddb5cb14d4aba411ec5877a5946248`.
- Prior held review seal:
  `4d80995620b52ee3ba2f6783c248fa50d1fc9681`.
- Remediation-round-two final candidate:
  `7832c703ddbc2d527d83b2a810d8f6890db9fdca`.
- Final reviewed implementation/evidence seal:
  `e49214949fcacdb6b9e3b8cb1e6478bb177986dc`.
- Implementation Architect token:
  `APPROVE_B5A2A_IMPLEMENTATION_CANDIDATE`.
- Implementation Verifier token:
  `PASS_B5A2A_IMPLEMENTATION_CANDIDATE`.
- Implementation Acceptance token:
  `ACCEPT_B5A2A_IMPLEMENTATION_CANDIDATE_AND_PUSH`.
- Execution-seal authoring token: `GO_B5A2A_EXECUTION_SEAL_AUTHORING`.
- Superseded execution-seal candidate:
  `8313f588a29da787914fafecb18f2b8cdba09b01`.
- Accepted corrected execution seal:
  `31df2431a6eb0a0473a1f4fb5bba884233888e1e`.
- Execution-seal Architect token: `APPROVE_B5A2A_EXECUTION_SEAL`.
- Execution-seal Verifier token: `PASS_B5A2A_EXECUTION_SEAL`.
- Execution-seal Acceptance token: `ACCEPT_B5A2A_EXECUTION_SEAL_AND_PUSH`.
- Lifecycle authoring token: `GO_B5A2A_LIFECYCLE_SEAL_AUTHORING`.
- Implementation remediation rounds used: 2 of 2. The remediation allowance is
  exhausted; this lifecycle record authorizes no further implementation,
  evidence, verifier, inventory, or source change.
- This transition closes only B5A2A's repository-only actor-safe projections.
  B5A2B and B5A3-B5A8 remain blocked. Dependency audit remains
  `STALE_UNREVALIDATED`, advisories remain `UNKNOWN`, and
  `CF-P1-AUDIT-FRESH-01` remains open. Permission migration remains
  `DESIGN_REQUIRED`. Representative database/provider and public-runtime
  evidence remain blocked. Local, shared-development, staging, pilot, and
  production readiness remain `FAIL`. Re-theme/taste validation, CRM/Odoo,
  Composio, agent-runtime, credentials, deployment, and release remain blocked
  pending their own exact gates.

## Execution gate

`HISTORICAL_EXECUTION_ONLY`; any new B5A2A work requires a new exact gate.
