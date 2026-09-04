# CF-P1-B5A3 — Upload and media authority boundary

## Objective

Replace the media library's identity-only upload grant, caller-authored URL
persistence, unbounded read, and ID-only delete with an actor-derived,
subaccount-bound, finite service boundary. Keep avatar, agency-logo,
subaccount-logo, and funnel-favicon provenance blocked until their owning
workflows can bind a completed provider object to an exact resource without an
unprovisioned-owner exception.

This is a documentation-only implementation gate. It does not authorize source
implementation until Architect, Verifier, and Acceptance approve the same
immutable gate SHA.

## Problem

All four UploadThing routes currently accept a valid provider identity as the
entire authorization decision. They do not resolve a local actor, agency,
subaccount, role, permission, target resource, or purpose. Their completion
callbacks do nothing.

The media UI uploads through the wrong `subaccountLogo` route, retains only a
browser-visible URL, and separately calls a server action with caller-authored
ownership. Media listing is unbounded and authorization-free. Media deletion
trusts only a media ID, deletes only the database row, and incorrectly tells
the user that downstream access to the physical file is removed.

The non-media asset flows cannot be closed honestly in the same no-schema,
no-provider checkpoint. Their URLs are assigned later by agency, subaccount,
team, and funnel mutations, no durable or signed receipt links those
assignments to an upload, and initial agency-logo upload occurs before the
local agency owner is provisioned.

## Goal

Split B5A3 into two explicit boundaries:

1. **B5A3A — media-library authority:** define an implementation-ready local
   boundary for the `media` route, its completion persistence, bounded listing,
   library removal, client adoption, legacy action retirement, and synthetic
   no-network verification.
2. **B5A3B — asset provenance and physical lifecycle:** retain a hard
   `DESIGN_REQUIRED` block for avatar, agency logo, subaccount logo, funnel
   favicon, durable provider-object cleanup, and physical deletion.

Completing B5A3A must not mark B5A3, B5A3B, or provider-object lifecycle
`DONE`.

## Scope

B5A3A is limited to the dedicated media route and callback; an exact media
service/action boundary; the two current readers; the one current creator; the
one current deleter; their exact UI/type path; the tenant action matrix; fixed
synthetic tests and verifier; authority-inventory reconciliation; and bounded
evidence/lifecycle records.

B5A3B is documented but not executable under this gate.

## Non-goals

This gate does not:

- modify the avatar, `agencyLogo`, or `subaccountLogo` route configuration or
  callback;
- authorize funnel-favicon upload or any agency, subaccount, team, or funnel
  owning mutation;
- physically delete, enumerate, migrate, or reconcile provider objects;
- add an upload-intent, tombstone, outbox, quota, or cleanup schema;
- access UploadThing credentials, call UploadThing or another network service,
  use representative data/database state, or deploy;
- change a dependency, package manifest, lockfile, Prisma schema, migration,
  middleware public-route rule, or readiness state; or
- begin re-theme, CRM/Odoo, Composio, Stripe expansion, or agent-runtime work.

## Dependencies and blockers

B5A2B lifecycle acceptance and its normal push are satisfied at the exact
parent below. B5A3A implementation remains blocked pending exact gate review.
B5A3B remains design-required because safe cross-request provenance and
provider cleanup require separately approved owning-domain and likely durable
state changes.

Audit freshness, dependency remediation, permission migration, representative
provider/database evidence, public runtime, deployment, and every readiness
state remain hard holds.

## Immutable authority

- Exact parent: `54e47cca41922e303bbd2ced6056e9462562172e`.
- Parent acceptance token: `ACCEPT_B5A2B_LIFECYCLE_AND_PUSH`.
- Gate-authoring token: `GO_B5A3_IMPLEMENTATION_GATE_AUTHORING`.
- Gate-remediation token: `GO_B5A3_GATE_REMEDIATION_1`.
- Gate remediation used: 1 of 2 rounds.
- Branch: `codex/crewframe-foundation`.
- Parent authority inventory: exactly 231 records.
- Parent inventory manifest:
  `sha256:073ec09f33f304352df5f6f262a4e197c2139c11788dff113745593b414c7258`.
- Maximum gate remediation rounds: 2.
- Maximum B5A3A implementation remediation rounds: 2.
- Target: fixed local repository input, pure services, injected synthetic
  stores, no-network provider-shaped fixtures, and one isolated disposable
  synthetic MySQL adapter proof.
- Text hashes use UTF-8 SHA-256 after CRLF/CR normalization to LF. Binary
  hashes use raw bytes.

## Gate state

- B5A2B: `DONE` and `HISTORICAL_EXECUTION_ONLY`.
- B5A3 umbrella: `READY_SPLIT`; execution remains `BLOCKED`.
- B5A3A media-library authority: `ALLOWLIST_DEFINED`; execution remains
  `BLOCKED_PENDING_REVIEW`.
- B5A3B non-media provenance and physical lifecycle:
  `DESIGN_REQUIRED_BLOCKED`.
- B5A4-B5A8: `BLOCKED`.

No implementation or production authority is inherited from the parent or
this draft.

## Exact 18-record binding

The parent contains exactly 18 `upload/media` records. All have
`action=UNDEFINED_BLOCKED` and `actorSource=blocked`.

| Exact `surfaceId` | B5A3 disposition |
| --- | --- |
| `API handler:src/app/api/uploadthing/route.ts#GET` | Shared transport; freeze in B5A3A; remains B5A3B-blocked. |
| `API handler:src/app/api/uploadthing/route.ts#POST` | Shared transport; freeze in B5A3A; remains B5A3B-blocked. |
| `internal-only:src/app/api/uploadthing/core.ts#$upload-authenticate` | Legacy shared identity-only path; the media branch must stop using it, but it remains frozen for three blocked routes. |
| `internal-only:src/features/uploads/upload-auth.ts#getAuthenticatedUploadMetadata` | Freeze; no longer sufficient for media authority and retained only for three blocked routes. |
| `page loader:src/app/(main)/subaccount/[subaccountId]/media/page.tsx#default` | B5A3A closes through the actor-safe bounded media service. |
| `provider callback:src/app/api/uploadthing/core.ts#$provider:uploadthing.createUploadthing` | Shared provider factory; freeze its construction and dependency. |
| `provider callback:src/app/api/uploadthing/route.ts#$provider:uploadthing.createNextRouteHandler` | Shared provider transport; freeze. |
| `server action:src/lib/queries.ts#createMedia` | B5A3A removes with no alias, wrapper, or URL-accepting replacement. |
| `server action:src/lib/queries.ts#deleteMedia` | B5A3A removes and replaces with an exact tenant-bound library-removal action. |
| `server action:src/lib/queries.ts#getMedia` | B5A3A removes and replaces with an actor-safe bounded view. |
| `upload router/callback:src/app/api/uploadthing/core.ts#$upload-callback:agencyLogo` | B5A3B blocked and byte/AST frozen. |
| `upload router/callback:src/app/api/uploadthing/core.ts#$upload-callback:avatar` | B5A3B blocked and byte/AST frozen. |
| `upload router/callback:src/app/api/uploadthing/core.ts#$upload-callback:media` | B5A3A replaces with exact completion revalidation and persistence. |
| `upload router/callback:src/app/api/uploadthing/core.ts#$upload-callback:subaccountLogo` | B5A3B blocked and byte/AST frozen. |
| `upload router/callback:src/app/api/uploadthing/core.ts#$upload-route:agencyLogo` | B5A3B blocked and byte/AST frozen. |
| `upload router/callback:src/app/api/uploadthing/core.ts#$upload-route:avatar` | B5A3B blocked and byte/AST frozen. |
| `upload router/callback:src/app/api/uploadthing/core.ts#$upload-route:media` | B5A3A replaces with typed intent and tenant authority. |
| `upload router/callback:src/app/api/uploadthing/core.ts#$upload-route:subaccountLogo` | B5A3B blocked and byte/AST frozen. |

The fixed verifier must also bind every currently untracked client helper,
route caller, URL sink, generated helper, provider file field, and persistence
operation described below. No renamed equivalent may evade the 18-record
ledger.

## Parent source facts

### Canonical normalized hashes

| Path | Parent hash |
| --- | --- |
| `src/app/api/uploadthing/core.ts` | `sha256:d80e1e38d660592135c02e4832a153d93ae72a6d90df9ea7e4dc8e964948aee0` |
| `src/app/api/uploadthing/route.ts` | `sha256:c0ea7c7aaf643333c9df2dab71df073dbad5008c74efcdd58a357f2c1c4c8357` |
| `src/features/uploads/upload-auth.ts` | `sha256:17ee7ae9db26faf069a48ce2b214013148758e9e289026e0bd894947809adfaf` |
| `src/lib/uploadthing.ts` | `sha256:3364be3b3a32d4e50027399fd8b7b0d6ad3cd80c763cbc3e0d41537b0eedb626` |
| `src/components/global/file-upload.tsx` | `sha256:99c078222cda4563b02fabc49479ab1cae63622d5f6c3a8f77706c7f2d685bf2` |
| `src/components/forms/upload-media.tsx` | `sha256:3e5683d790732f10c1a977b486bffb5ad51583a36b4feccd5d7b49cb272b6c25` |
| `src/components/media/media-card.tsx` | `sha256:282a4053c0d1734797c78532e2f3e095334e7b1fdb2cc056f80fb0f743664e36` |
| `src/components/media/index.tsx` | `sha256:f4996b2573189e0dd680180819a5498e3724f4d1552ab47962960864e3020c33` |
| `src/app/(main)/subaccount/[subaccountId]/media/page.tsx` | `sha256:f8a9273fe67386672c3a027badc39db38d4781b047284ae4765fdf0e70aca9c3` |
| `src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor-sidebar/tabs/media-bucket-tab.tsx` | `sha256:8e4a48d8284e992ba4d4b760aa80b0317a75024f71ae5448968571525c2a3c07` |
| `src/lib/queries.ts` | `sha256:c0fff921c03f3d40c3675d7ff85603e082be512b087e8f87572365e3d8cef892` |
| `src/lib/types.ts` | `sha256:9a1b8c7703279a3eef54b4f252fe3dace791a62ff795c5367e4973a4cf13c832` |
| `prisma/schema.prisma` | `sha256:69ec7ba100cdb0d1907d3ba62d71a0fab206a837a24e13e09bb5cd6dabc535cb` |

### Current route and client graph

- Four route slugs exist: `agencyLogo`, `avatar`, `media`, and
  `subaccountLogo`.
- Each accepts the broad `image` category with `maxFileSize='4MB'` and
  `maxFileCount=1`, uses the same identity-only middleware, and has a no-op
  completion callback.
- `/api/uploadthing` is the only exact public transport path. Nested paths
  remain protected.
- `FileUpload` has exactly five importers and five JSX calls: one
  `agencyLogo`, one `avatar`, and three `subaccountLogo` calls. The dedicated
  `media` route has zero client callers.
- The three `subaccountLogo` calls serve subaccount logo, funnel favicon, and,
  incorrectly, media-library upload.
- The generic client retains `res[0].url`, ignores provider key/custom ID, and
  logs a raw provider error.
- Browser-returned URLs flow to `upsertAgency`, `upsertSubAccount`,
  `updateMyProfile`, `upsertFunnel`, and `createMedia`.
- Generated `UploadButton`, `Uploader`, `useUploadThing`, and `uploadFiles`
  exports have no production callers.

### Current persistence graph

- `getMedia` has exactly two callers and performs one unscoped
  `SubAccount.findUnique({id, include:{Media:true}})` with no order, bound,
  DTO, or overflow sentinel.
- `createMedia` has exactly one caller and accepts browser-authored
  `subaccountId`, `name`, and arbitrary `link` through a broad Prisma-derived
  type.
- `deleteMedia` has exactly one caller and deletes by browser-authored
  `mediaId` without tenant ownership, expected state, affected-count proof, or
  provider deletion.
- `Media` stores `id`, nullable `type`, `name`, globally unique `link`,
  `subAccountId`, and timestamps. It stores no provider key, upload intent,
  uploader, size, MIME, lifecycle state, deletion state, or cleanup metadata.
- No `UploadIntent` model, provider cleanup operation, media quota, or direct
  media behavior tests exist.

## B5A3A frozen decisions

### Route input and file policy

The `media` route accepts exactly one file and strict input with exactly:

- `subaccountId`: canonical UUID string; and
- `name`: trimmed, nonempty, 1-120 Unicode code points, with control
  characters and path delimiters rejected.

Unknown keys, arrays, coercion, blank values, malformed UUIDs, overlong names,
or multiple files fail before an authority read. The route accepts only
`image/jpeg`, `image/png`, and `image/webp`, each with a maximum size of
4 MiB. Middleware additionally proves total file cardinality is exactly one
and verifies the announced size and MIME against this closed set. SVG, GIF,
PDF, generic `image/*`, extension-only trust, and client-only validation are
not accepted by the media route.

Input normalization and grammar are exact:

- a UUID is the lowercase, hyphenated RFC 4122 version-4 form matched by
  `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`;
  uppercase, braced, compact, nil, non-v4, or whitespace-bearing forms are
  rejected rather than coerced;
- `subaccountId`, `mediaId`, and server-generated `intentId` use that same
  grammar, and generation uses the runtime cryptographic UUID-v4 primitive;
- a display name must be a well-formed Unicode string with no lone surrogate,
  is normalized with Unicode NFC, then trimmed using ECMAScript `trim`, and is
  counted by Unicode code points after normalization and trimming;
- an empty result, more than 120 code points, any code point in U+0000-U+001F
  or U+007F-U+009F, solidus `/` U+002F, or reverse solidus `\` U+005C is
  rejected; all other printable code points, including internal spaces, are
  retained exactly; and
- validation never performs case folding, locale mapping, compatibility
  normalization, filename extraction, path normalization, or truncation.

The one caller-announced source filename is separately required to be
well-formed NFC already, unchanged by ECMAScript `trim`, 1-255 Unicode code
points, and free of U+0000-U+001F, U+007F-U+009F, `/`, and `\`. It is not used
as authority or persisted as the media display name. Announced size must be an
integer from 1 through 4,194,304 bytes, and announced MIME must equal one of
the three exact lowercase MIME literals. Middleware copies these three
untrusted announced values into closed metadata solely for equality checks at
completion; it does not normalize or repair them.

The other three route slugs, configurations, middleware calls, and callbacks
remain exact. The public routing rule remains exactly `/api/uploadthing`; no
nested or additional path becomes public.

### Exact media action matrix

The existing closed `TenantAction` policy adds exactly `media:list`,
`media:create`, and `media:delete`.

| Role | `media:list` | `media:create` | `media:delete` |
| --- | --- | --- | --- |
| `AGENCY_OWNER` | allow | allow | allow |
| `AGENCY_ADMIN` | allow | allow | allow |
| `SUBACCOUNT_USER` | allow for exact permission | allow for exact permission | allow for exact permission |
| `SUBACCOUNT_GUEST` | allow for exact permission | deny | deny |
| Unknown, missing, or caller-authored role | deny | deny | deny |

Every method resolves identity and the exact tenant context internally before
any media read or write. Agency role alone cannot cross to a foreign agency.
Subaccount roles require exactly one active permission for the requested
subaccount. Missing, false, duplicate, orphan, revoked, deleted, conflicting,
or cross-agency permission state fails closed.

### Grant contract

The client chooses only the requested `subaccountId`, bounded display `name`,
and local file. The route fixes the purpose to `MEDIA` from the route branch.
The server resolves provider subject to one exact local actor, then one exact
tenant context, and applies `media:create` before returning any provider grant.
Provider subject or authenticated UI reachability alone is insufficient.

Middleware generates a cryptographically unpredictable UUID `intentId` and
returns closed provider-round-tripped metadata with exactly:

- `intentId`;
- `actorId`;
- `agencyId`;
- `subaccountId`;
- `purpose: 'MEDIA'`; and
- normalized `name`;
- `announcedFileName`;
- `announcedMimeType`; and
- `announcedSize`.

It assigns `intentId` as the UploadThing file `customId` through the supported
`UTFiles` metadata mechanism. Actor ID, agency ID, purpose, intent ID, and
custom ID are server-derived and never come from caller input. At grant time,
file name, MIME, and size are untrusted caller-announced values used only to
reject a request outside the closed route policy. At completion, the SDK
supplies provider-signed callback fields for file name, MIME, size, key, URL,
and custom ID; the boundary revalidates and compares them but does not claim
that those fields prove magic bytes, decoded content, or actual stored-byte
length. Metadata and file arrays are fresh exact objects; no request,
identity, ORM, or provider object is spread into them.

This metadata is an ephemeral, provider-bound completion receipt, not a
durable general-purpose `UploadIntent`. The distinction is mandatory evidence,
not terminology to be hidden.

### Completion and idempotency contract

The SDK-authenticated `media` completion callback passes only the closed
metadata and the provider-reported file projection into the server media
service. The callback strictly validates every metadata field, file
`customId`, MIME, size, name bounds, provider URL, and cardinality. It requires
`file.customId === metadata.intentId`, purpose `MEDIA`, an allowed MIME, size
at most 4 MiB, exact equality of callback file name/MIME/size with the three
announced metadata values, and an exact valid HTTPS provider URL with a fixed
2,048-code-point maximum.

The stored provider URL uses the callback `file.url` and must pass this exact
grammar after WHATWG `URL` parsing: source length 1-2,048 Unicode code points;
protocol exactly `https:`; hostname exactly lowercase `utfs.io`; empty
username, password, explicit port, query, and fragment; path exactly
`/f/<key>`; and the raw `<key>` must contain no percent sign, equal the callback
`file.key`, be 1-512 ASCII characters, and match `^[A-Za-z0-9_-]+$`. The parsed URL must
serialize back to the identical source string. Alternate hosts, IP literals,
Unicode/punycode host aliases, dot segments, percent-encoded separators,
userinfo, nondefault or explicit ports, queries, fragments, and callback
`appUrl` are rejected. Provider rehearsal must confirm this frozen v6 URL
shape before deployment; a provider shape change is a stop, not an allowlist
expansion.

MIME/size validation here proves agreement among the configured SDK policy,
the untrusted grant announcement, and provider-signed completion fields only.
Actual-byte length, magic-byte/content sniffing, decompression behavior, image
decode safety, and malware scanning remain B5A3B/provider-rehearsal work and
must not be reported as B5A3A guarantees.

Before persistence, completion resolves the current actor by the server-bound
`actorId`, re-resolves current agency/subaccount membership and permission,
and reapplies `media:create`. Revocation, deletion, reassignment, or ownership
drift between grant and completion produces zero database writes.

Persistence uses `intentId` as `Media.id`, stores only the normalized display
name, provider URL, exact MIME, and bound `subAccountId`, and implements atomic
insert-or-get convergence:

- the first valid completion creates exactly one row;
- an exact retry or concurrent duplicate resolves to the same exact row and
  returns the same fresh DTO;
- an existing ID with any different link, name, type, or subaccount is
  `CONFLICT`;
- an existing global link under another ID is `CONFLICT`; and
- no conflict reveals which actor, tenant, ID, link, or stored value exists.

The operation may use a Prisma transaction/upsert plus exact postcondition
validation, but must not weaken global uniqueness, perform a preliminary
unauthorized existence lookup, or treat a unique error as success without
comparing the complete stored projection.

The callback returns only the exact media DTO. The media client uses that
completion result and does not call a second create action or submit a raw URL.

### Exact media DTO and list contract

The public media DTO contains exactly:

- `id`;
- `name`;
- `url` (mapped from storage `link`);
- `mimeType` (mapped from storage `type` and never nullable in the DTO);
- `createdAt` as canonical ISO-8601 string; and
- `updatedAt` as canonical ISO-8601 string.

It excludes `subAccountId`, agency, actor, provider subject/key/custom ID,
permissions, raw ORM models, relations, and every unlisted field.

The internal persistence projection contains exactly the six DTO source fields
plus `subAccountId`: `id`, `name`, `link`, `type`, `createdAt`, `updatedAt`, and
`subAccountId`. The pure service requires the internal `subAccountId` to equal
the resolved tenant context before constructing a fresh public DTO, then
strips it. No broader record or relation may be returned merely to perform the
postcondition.

`listMedia(requestedSubaccountId)` resolves tenant context and applies
`media:list` before querying. Persistence selects only the exact internal
projection with predicate `subAccountId = context.subaccountId`, order
`createdAt DESC, id DESC`, and `take: 101`. Zero rows returns `[]`; at most 100
rows returns fresh DTOs; the 101st sentinel, duplicate ID, nullable/invalid
type, invalid URL, malformed timestamp, ownership mismatch, unstable order, or
unlisted adapter field rejects the entire result as `CONFLICT`.

The page loader and editor tab consume the exact list. No authorized actor
receives an agency-wide or broad SubAccount/Media graph for later in-memory
authorization filtering.

### Library-removal contract

The action accepts exactly `subaccountId`, `mediaId`, and
`expectedUpdatedAt`. It strictly validates the input, resolves tenant context,
and applies `media:delete` before any media read or write. The adapter performs
one conditional `deleteMany` with exact predicate:

`id = mediaId AND subAccountId = context.subaccountId AND updatedAt = expectedUpdatedAt`.

Exactly one affected row is success. Zero or more than one is a finite,
non-enumerating conflict; no fallback lookup or ID-only delete is allowed.
Foreign, missing, stale, duplicate-click, and concurrent removal therefore
produce no unauthorized write.

`expectedUpdatedAt`, internal timestamps, and serialized DTO timestamps use
only canonical UTC ISO-8601 millisecond form
`YYYY-MM-DDTHH:mm:ss.sssZ`, matched by
`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$` and accepted only when
`new Date(value).toISOString() === value`. Offsets, missing milliseconds,
expanded years, leap-second text, invalid calendar values, whitespace, and
noncanonical-but-parseable forms are rejected. The server converts the exact
validated value to a `Date` only for the conditional Prisma predicate.

The UI action and copy say **Remove from media library**, not delete physical
file. They explicitly avoid claiming that copied URLs, embedded references, or
the provider object stop working. B5A3A performs no provider deletion, fetch,
head request, cleanup, event, job, or tombstone write.

### Finite failures and data minimization

The boundary maps all denials to the existing finite `AccessError` contract:

- anonymous identity: `UNAUTHENTICATED`;
- provider-authenticated subject without one local actor:
  `PROVISIONING_REQUIRED`;
- invalid input, foreign scope, denied action, missing/revoked permission,
  purpose/slug/metadata substitution, or missing/deleted tenant: `FORBIDDEN`;
- missing target after an authorized exact lookup: `RESOURCE_NOT_FOUND`; and
- duplicate, ambiguous, corrupt, stale, over-limit, invalid returned row, or
  failed exact postcondition: `CONFLICT`.

No raw provider/database error, subject, actor/tenant ID, filename, display
name, URL, key, custom ID, metadata, payload, request, credential, environment
value, or stack trace enters logs, toasts, evidence, or verifier output. Owned
modules contain no `console.*` path. Every denied case has zero persistence
write and zero provider/network side effect.

## B5A3B retained design block

B5A3B remains blocked over all of the following:

- avatar, agency-logo, subaccount-logo, and funnel-favicon grant purpose and
  target-resource binding;
- safe agency onboarding order when the owner does not exist at grant time;
- a durable or signed single-use receipt for later owning-domain assignment;
- replacement, cancellation, abandoned upload, failed completion, tenant
  cascade, and provider cleanup behavior;
- durable physical-deletion intent, retry, tombstone, and reconciliation;
- storage object/byte quotas and retention; and
- legacy object/key provenance and existing-object cleanup.

No authenticated-only onboarding exception is permitted. A later gate must
choose and verify owner-first provisioning or a separately reviewed finite
bootstrap protocol; direct callback assignment, durable intent, and signed
receipt alternatives must be assessed against each owning domain.

B5A3A deliberately does not claim prevention of a provider object orphan if
the provider accepts bytes but its signed completion cannot persist after all
provider retries. The `customId=intentId=Media.id` binding makes new successful
rows addressable for a future lifecycle, but it is not a deletion record or
cleanup guarantee. Any report that labels this residual risk closed fails the
gate.

## Closed feature architecture

B5A3A may add exactly three production modules:

1. `src/features/media/media-service.ts` exports exactly
   `createMediaService` and `assertMediaAction` as runtime symbols. It contains
   strict pure DTO/input/metadata/file parsing, action policy, ownership and
   cardinality validation, completion convergence, list ordering/overflow,
   removal postconditions, and injected store/context interfaces.
2. `src/features/media/server-media-service.ts` imports `server-only`, accepted
   identity/context adapters, Prisma, and the pure service. It exports the sole
   runtime symbol `mediaService`, which supplies provider grant, completion,
   list, and removal methods through exact adapters.
3. `src/features/media/actions.ts` imports `server-only` and exports only the
   exact client-callable list and removal actions needed by the two existing
   UI surfaces. It exports no raw create-by-URL action.

Type-only exports are limited to exact inputs, DTO, role/action, metadata,
provider-file projection, injected dependency, and service types required by
these runtime symbols. No `any`, broad `unknown` assertion, request/ORM/provider
model export, index signature, permissive passthrough schema, or generic
authority wrapper is allowed.

`core.ts` calls the server media service only from the `media` branch. It does
not import Prisma, perform direct persistence, create another provider client,
or modify the three blocked branches.

## Exact client and legacy closure

- `UploadMediaForm` retains bounded name entry but replaces its `link` field,
  generic `FileUpload`, `createMedia` import/call, submit button, and raw error
  log with a dedicated `media` UploadDropzone carrying only
  `{subaccountId,name}` input.
- Completion closes the modal or refreshes only after receiving the exact
  callback DTO. Errors use fixed user copy with no raw value.
- `MediaComponent` consumes `readonly MediaDto[]`, not `GetMediaFiles`, a
  SubAccount graph, or Prisma `Media`.
- `MediaCard` consumes `MediaDto`, calls the exact tenant-bound removal action
  with `subaccountId`, `id`, and `updatedAt`, handles failure without claiming
  success, and uses the corrected library-removal language.
- The media page and editor tab use only the exact actor-safe list method/action
  and never import a broad legacy query.
- `getMedia`, `createMedia`, `deleteMedia`, `GetMediaFiles`, and
  `CreateMediaType` are removed with zero aliases, wrappers, re-exports,
  namespace/computed access, dynamic imports, URL-compatible fallbacks, or
  renamed equivalents.
- The dedicated media path no longer imports or calls the generic
  `FileUpload`. The generic component and all non-media consumers remain
  frozen, including its known raw-error log, which is retained as a B5A3B
  defect and cannot become reachable from media.

## Concrete B5A3A file allowlist

After exact gate approval, B5A3A may add or modify only these files.

### New production boundary

- `src/features/media/media-service.ts` (new)
- `src/features/media/server-media-service.ts` (new)
- `src/features/media/actions.ts` (new)

### Exact existing production surfaces

- `src/app/api/uploadthing/core.ts` (imports and `media` branch only; the three
  non-media route/callback ASTs remain exact)
- `src/lib/auth/policy.ts` (only three exact media actions and matrix entries)
- `src/lib/queries.ts` (remove exactly three legacy media exports; complete
  remainder frozen)
- `src/lib/types.ts` (remove exactly `GetMediaFiles` and `CreateMediaType` plus
  imports dead solely from their removal; complete remainder frozen)
- `src/components/forms/upload-media.tsx`
- `src/components/media/index.tsx`
- `src/components/media/media-card.tsx`
- `src/components/media/upload-buttons.tsx`
- `src/app/(main)/subaccount/[subaccountId]/media/page.tsx`
- `src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor-sidebar/tabs/media-bucket-tab.tsx`

### Fixed tests and verification

- `tests/media/media-service.test.ts` (new)
- `tests/media/media-completion.test.ts` (new)
- `tests/media/media-surface.test.ts` (new)
- `tests/database/b5a3a-media-mysql.test.ts` (new)
- `scripts/verify-b5a3a-media-boundary.ts` (new)
- `scripts/verify-b5a3a-media-mysql.ps1` (new)
- `tests/auth/uploadthing-security-surface.test.ts` (only exact B5A3A media
  assertions and superseded media-branch expectations)
- `tests/auth/upload-auth.test.ts` (only an exact retained-legacy assertion
  if required; no weakening)
- `tests/auth/policy.test.ts` (only exact media-action matrix assertions and
  protected remainder checks)
- `scripts/verify-b5a2b-notification-boundary.ts` (only exact B5A3A allowlist
  succession; every B5A2B invariant remains effective)
- `scripts/verify-b5a2a-projections.ts` (same limitation)
- `scripts/agency-authority-inventory-lib.ts` (only exact B5A3A discovery,
  action, ownership, effect, disposition, and count reconciliation)
- `tests/authority-inventory/agency-authority-inventory.test.ts` (only exact
  B5A3A drift assertions)
- `docs/security/agency-authority/inventory.json`
- `docs/security/agency-authority/inventory.lock.json`

### Evidence and lifecycle

- `docs/evidence/CF-P1-B5A3A-candidate-verification.json` (new)
- `docs/execution/CF-P1-B5A3A-media-library-authority.md` (new)
- this work item for exact lifecycle metadata only after implementation review

Unlisted source, test, tooling, inventory, documentation, package, schema,
configuration, middleware, public, provider, and deployment files are
forbidden.

## Explicit frozen surfaces

These paths are outside B5A3A even where discovery found a defect:

- `src/app/api/uploadthing/route.ts`
- `src/features/uploads/upload-auth.ts`
- `src/lib/uploadthing.ts`
- `src/lib/routing/middleware-routing.ts`
- `src/components/global/file-upload.tsx`
- `src/components/forms/agency-details.tsx`
- `src/components/forms/subaccount-details.tsx`
- `src/components/forms/user-details.tsx`
- `src/components/forms/funnel-form.tsx`
- every owning validation/action module for agency, subaccount, team, and
  funnel assets
- `prisma/schema.prisma` and every migration
- `package.json` and `bun.lockb`
- the accepted B5A2B dormant activity foundation

The three non-media upload branch ASTs, shared route factory, exact-public
routing predicate, and all non-media URL sinks are protected by hash/remainder
tests. Their insecurity remains visible and blocked; it is not waived.

## Required adversarial verification

### Grant and completion

- anonymous, blank subject, missing local actor, null agency, malformed/extra
  input, overlong/control/delimiter name, invalid UUID, zero/multiple files,
  disallowed MIME, oversized file, and spoofed extension;
- foreign agency/subaccount, missing/deleted scope, revoked/false/duplicate/
  conflicting/orphan permission, and guest create denial;
- route slug, purpose, intent, actor, agency, subaccount, custom ID, name, MIME,
  size, URL, and metadata substitution independently;
- actor, agency, subaccount, or permission revocation/deletion between grant
  and completion;
- exact retry and concurrent identical completion convergence;
- same intent with changed link/name/type/subaccount and same global link with
  a foreign ID; and
- injected create failure, transaction rollback, invalid adapter postcondition,
  and zero partial row.

Every denial proves zero database writes and zero provider/network calls. No
test contacts UploadThing.

### Disposable synthetic MySQL proof

Pure injected-store tests are necessary for exhaustive denial and mutation
coverage but are insufficient evidence for Prisma/MySQL atomicity. The
candidate must therefore execute the real generated Prisma client and exact
production media adapter against a fresh disposable MySQL 8.4 container using
the unchanged checked-in schema and synthetic fixtures only.

`scripts/verify-b5a3a-media-mysql.ps1` owns the proof. It:

- uses a digest-pinned, already-local MySQL 8.4 image with `--pull=never` and
  performs no registry or other external network access;
- rejects ambient `DATABASE_URL`, MySQL, container-name, and project credential
  inputs; generates a process-local random container name, database name,
  port, and disposable password; and never prints or persists them;
- resolves and verifies the exact repository root, schema, generated client,
  production adapter, and script/test hashes before execution;
- starts one isolated container without a host bind mount, provisions the
  unchanged schema into the empty disposable database, and inserts only fixed
  synthetic agency, actor, subaccount, permission, and media-shaped fixtures;
- exercises real concurrent exact completion, changed-field collision,
  global-link collision, transaction rollback, exact retry, list order/
  sentinel, foreign/stale removal, and concurrent `deleteMany` affected-count
  behavior through the production adapter;
- verifies zero unexpected rows before and after every fault path and emits
  only bounded pass/fail identifiers and counts; and
- in a `finally` path stops/removes only the exact validated disposable
  container, restores prior process environment, proves the container and
  database are gone, and fails if cleanup cannot be proven.

It may use loopback solely to reach its own disposable container. It may not
read a developer database, use representative records, run a migration, alter
the checked-in schema, connect to a non-loopback host, reuse a container or
volume, pull an image, or retain database artifacts. The test fails closed if
Docker, the pinned local image, a collision-safe free port, Prisma generation,
or cleanup proof is unavailable. No skip converts missing infrastructure into
a pass.

### List and DTO

- each allowed role and each denied role/action pair;
- foreign, missing, deleted, duplicate, false, revoked, or cross-agency
  membership/permission;
- authorized empty, exact 100 rows, 101st-row rejection, duplicate ID, nullable
  or disallowed type, invalid URL/date, ownership mismatch, and unstable order;
- tied timestamps under `createdAt DESC, id DESC`; and
- exact fresh-object DTO snapshots with explicit rejection of
  `subAccountId`, actor, agency, permission, key/custom ID, and every broad
  Prisma/relationship/unlisted field.

### Removal and race handling

- owner/admin/subaccount-user success; guest and unknown-role denial;
- malformed/extra input before persistence, foreign agency/subaccount/media,
  missing/deleted media, stale `updatedAt`, duplicate click, and concurrent
  removal;
- exact predicate and affected-count mutation, including independent removal
  of `subAccountId` or `updatedAt` and count changes from one to zero/multiple;
- rollback and adapter exception with no false success toast; and
- zero provider delete/fetch/cleanup/event/job call plus exact library-removal
  wording.

### Surface, mutation, and protected remainder

- independently mutate every route input key/bound, MIME, size, count,
  middleware context step, role/action pair, metadata key, custom-ID binding,
  completion revalidation, persistence predicate, unique/collision branch,
  list projection/order/limit/sentinel, removal predicate, and affected-count
  check;
- prove zero legacy media exports/types/importers/calls, raw URL/key ownership
  inputs, `subaccountLogo` media use, aliases, wrappers, re-exports, computed/
  namespace access, or dynamic imports;
- mutate every protected non-media route/callback, exact public-route rule,
  generic upload component, non-media caller, frozen query/type remainder, and
  historical B5A2A/B5A2B invariant independently and prove rejection; and
- reject injected Prisma schema/migration, package/lock, environment read,
  provider API/client, `fetch`, physical deletion, cleanup, activity event,
  log, raw error, payload, credential, deployment, re-theme, CRM/Odoo,
  Composio, or agent-runtime change.

## Fixed-input verifier

`scripts/verify-b5a3a-media-boundary.ts` takes zero arguments and reads only
fixed versioned paths. It cannot receive paths, symbols, hashes, limits,
taxonomies, ignore lists, or baselines from arguments or environment values.

Using the repository TypeScript version, it parses the accepted parent and
candidate, normalizes line endings, removes or type-erases only exact
allowlisted B5A3A nodes, prints normalized AST with LF newlines, and compares
the complete remainder. It binds:

- all 18 inventory records and their split disposition;
- the exact five `FileUpload` imports/calls and 1/1 UploadDropzone baseline;
- route distribution `agencyLogo=1`, `avatar=1`, `subaccountLogo=3`, `media=0`
  at parent and the exact dedicated media adoption at candidate;
- two list callers, one legacy create caller, one legacy delete caller, and
  complete retirement of the three actions and two broad types;
- all five current raw URL sinks, with only the media sink removed;
- the three non-media route/callback ASTs, two route handlers, both provider
  factories, legacy upload-auth helper, public routing predicate, generic
  upload component, non-media consumers, Prisma schema, migration tree,
  package manifest, lockfile, and B5A2B dormant foundation;
- exact new runtime exports/import graph, action matrix, input/DTO fields,
  query predicates, limits, order, file rules, finite outcomes, no-log rule,
  and zero provider/network reachability; and
- reconciled authority inventory records/counts and immutable manifest.

Verifier output is bounded to stable counts, hashes, SHAs, and pass/fail
identifiers. It emits no source, identity, tenant, filename, display name, URL,
key, metadata, payload, error detail, environment value, secret, credential,
stack trace, or representative data.

## Historical-verifier policy amendment

At the documentation-only B5A3 gate SHA, both immutable historical verifiers
are expected to exit nonzero with exactly these respective single diagnostics
and no other output failure:

`B5A2A_FAIL errors=1 first=allowlist:docs/issues/CF-P1-B5A3-upload-media-authority-boundary.md`

`B5A2B_FAIL errors=1 first=allowlist:docs/issues/CF-P1-B5A3-upload-media-authority-boundary.md`

Each error count must be one. No other diagnostic, stderr, crash, timeout,
skip, wrapper, output filter, ignored exit status, environment switch, or
verifier modification is accepted.

Before B5A3A implementation candidate review, the implementation must narrowly
extend historical verifiers for only gate-enumerated B5A3A paths and
superseded nodes and restore full passes. Every unaffected hash, algorithm,
baseline, mutation test, and invariant remains exact. The B5A3A verifier must
independently prove all newly allowed changes and reject unrelated drift.

## Candidate verification and evidence

Required commands at the exact immutable candidate and later seals:

1. `bun scripts/verify-b5a3a-media-boundary.ts`
2. `bun scripts/verify-b5a2b-notification-boundary.ts`
3. `bun scripts/verify-b5a2a-projections.ts`
4. `bun scripts/verify-agency-authority-inventory.ts`
5. focused media, upload-security, policy, and inventory tests
6. `powershell -File scripts/verify-b5a3a-media-mysql.ps1`
7. full `bun test`
8. `bun run lint`
9. `bun run typecheck`
10. isolated `bun run build`
11. frozen offline dependency continuity with the accepted lockfile
12. `npx prisma validate` without migration
13. `git diff --check`, exact allowlist, protected-remainder, and bounded
    secret/PII/log/network/provider/schema/package/public/deployment scans

No command may use a representative database/data, external provider/network
service, project credential, deployed route, or environment-derived verifier
input. Pure injected stores prove exhaustive service behavior; the separately
bounded disposable synthetic MySQL proof establishes real adapter atomicity,
uniqueness, rollback, and race behavior and is required in addition. A later
representative database and provider rehearsal requires its own exact gate.

Evidence records exact parent/gate/candidate/seal SHAs; the 18-record split;
client/caller/URL-sink counts; before/after inventory records/counts/hash;
action matrix; input/MIME/size/count/name/URL limits; completion idempotency;
list DTO/order/overflow; removal predicate/race behavior; residual physical-
object risks; mutation/remainder coverage; command/test counts; and explicit
zero-use statements for network, provider API, representative database/data,
credentials, schema, migration, packages, public-route change, deployment,
non-media assets, re-theme, CRM/Odoo, Composio, and agent runtime.

Evidence contains only stable counts, hashes, SHAs, pass/fail identifiers, and
repository-relative paths. It contains no source text or sensitive/runtime
values.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| B5A3A-01 | Candidate ancestry, exact parent/gate SHAs, clean worktree, LF-normalized hashes, and concrete allowlist reconcile. |
| B5A3A-02 | All 18 parent records, every client helper/caller/URL sink, and the exact six B5A3A closures versus twelve shared/blocked dispositions are exhaustively bound. |
| B5A3A-03 | The media grant resolves one local actor and exact tenant context, applies the fixed action internally, and binds one strict request to one server-generated intent/purpose/custom ID before provider grant. |
| B5A3A-04 | Only JPEG, PNG, and WebP, one file, 4 MiB, canonical UUID-v4, exact NFC/trim/name grammar, URL grammar, and timestamp grammar are accepted server-side; malformed or extra input fails before reads. |
| B5A3A-05 | Completion strictly revalidates metadata, provider-reported file fields, current actor/tenant/permission, custom ID, declared MIME/size, URL, and purpose before persistence without claiming actual-byte/content proof. |
| B5A3A-06 | `Media.id=intentId`; pure tests and the required disposable synthetic MySQL proof establish real Prisma atomic retry/concurrency/rollback behavior, while any ID/link/name/type/tenant mismatch or global-link collision fails closed without enumeration. |
| B5A3A-07 | Media list authorizes before persistence, selects only the exact DTO, orders `createdAt DESC,id DESC`, uses 101 sentinel/100 maximum, and returns no broad graph or partial result. |
| B5A3A-08 | Library removal validates exact tenant and expected `updatedAt`, uses the complete conditional predicate, requires affected count one, and handles foreign/stale/concurrent attempts without an unauthorized write. |
| B5A3A-09 | The client uses the dedicated `media` route and callback DTO; no raw browser-authored provider URL/key is accepted as ownership proof or sent to a create action. |
| B5A3A-10 | The three legacy actions, two broad types, all importers/calls, aliases, wrappers, re-exports, namespace/computed access, dynamic imports, and URL-compatible fallbacks are absent. |
| B5A3A-11 | The existing exact public route remains unchanged; three non-media routes/callbacks, generic upload component, non-media consumers/sinks, schema/migrations, packages, middleware, and historical foundations remain protected and visibly blocked. |
| B5A3A-12 | Every denied grant, completion, list, and removal case has zero database write and zero provider/network side effect; owned modules expose no raw logs/errors or sensitive evidence. |
| B5A3A-13 | Required adversarial and mutation tests prove every authority predicate, file/input bound, completion binding, idempotency branch, DTO/order/overflow clause, removal race, legacy retirement, and protected remainder. |
| B5A3A-14 | Fixed verifiers, focused/full tests, disposable synthetic MySQL adapter proof, lint, typecheck, isolated build, frozen install, Prisma validation, inventory, diff, allowlist, protected-remainder, and bounded scans pass at exact candidate and seals. |
| B5A3A-15 | No provider call, representative database/data, credential, schema/migration, package, public-route, deployment, non-media asset, physical cleanup, re-theme, CRM/Odoo, Composio, or agent-runtime work occurs. |
| B5A3A-16 | Evidence states that B5A3B and provider-object orphan/deletion lifecycle remain blocked; B5A3 umbrella is not marked done. |
| B5A3A-17 | Architect, Verifier, and Acceptance approve the same gate, candidate, execution seal, and lifecycle seal within the two-round limits before any next boundary begins. |

## Stop conditions

- Discovery differs from 18 inventory records, five `FileUpload` callers, the
  `1/1` UploadDropzone baseline, route distribution, two list callers, one
  create caller, one delete caller, or five URL sinks.
- UploadThing 6.13.3 cannot support strict input, middleware file cardinality,
  server metadata, `UTFiles.customId`, or callback output without a dependency
  change.
- The callback cannot atomically distinguish exact retry from a cross-tenant
  ID or link collision using the existing Media schema.
- Completion needs a durable pre-upload record, physical provider cleanup,
  network call, credential, schema/migration, representative database, or
  public-route change to meet B5A3A's stated claims.
- Safe media behavior requires changing an avatar, agency, subaccount, team,
  funnel, middleware, or other owning-domain mutation.
- Existing valid behavior requires more than 100 media rows without a separately
  approved pagination contract.
- A denial cannot prove zero database write and zero provider/network side
  effect, or a protected-remainder mutation escapes the verifier.

Any stop returns the candidate to Architect, Verifier, and Acceptance. It
grants no compatibility route, raw URL fallback, caller-authored authority,
schema/provider shortcut, or scope expansion.

## Preserved holds and forbidden work

- Dependency audit remains `STALE_UNREVALIDATED`; advisories remain `UNKNOWN`;
  `CF-P1-AUDIT-FRESH-01` remains open.
- Permission `userId` migration remains `DESIGN_REQUIRED`.
- Representative database/provider evidence and public runtime remain blocked.
- Local, shared-development, staging, pilot, and production readiness remain
  `FAIL`.
- B5A3B asset provenance, durable intent/cleanup, provider deletion, legacy
  object handling, and storage quotas remain blocked.
- No credential, provider network call, package, lockfile, Prisma schema/
  migration, destructive or representative data operation, public-route
  expansion, deployment, release, re-theme, design/taste validation,
  CRM/Odoo, Composio, Stripe expansion, or agent-runtime work is authorized.

This gate cannot weaken or close another hold.

## Rollback

B5A3A production, test, tooling, and inventory rollback restores those files
exactly to their state at accepted parent
`54e47cca41922e303bbd2ced6056e9462562172e`. The accepted remediated gate SHA,
candidate evidence, execution record, and later lifecycle entries remain
immutable history rather than being removed:

- remove the three new `src/features/media/` modules, three new media tests,
  the new database harness test, and both new B5A3A verifier scripts;
- restore every allowlisted existing source, test, historical verifier,
  inventory, and lock file exactly to the parent;
- retain this issue, accepted candidate evidence, and execution records
  unchanged as immutable history, then append only the rollback commit and
  outcome to this issue's lifecycle metadata; and
- run all fixed verifiers, focused/full tests, lint, typecheck, isolated build,
  frozen install, Prisma validation, diff, and bounded scans after restoration.

No schema, data, provider, credential, public-route, package, or deployment
rollback is permitted or required because none may change.

## Status

`READY`

## Execution gate

`BLOCKED`; requires fresh Architect, Verifier, and Acceptance approval of the
same immutable documentation-only gate SHA.
