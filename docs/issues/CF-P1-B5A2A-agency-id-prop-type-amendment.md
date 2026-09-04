# CF-P1-B5A2A — Agency ID prop type amendment

## Objective

Permit one type-only narrowing so every `SubAccountDetails` caller can pass a
minimal agency reference without overfetching a Prisma `Agency` or hiding that
overfetch behind a cast.

This amendment is documentation-only. It grants no production-change
authority and leaves the B5A2A implementation gate on hold.

## Immutable authority

- Accepted B5A2 intake:
  `90b0cdb0855a3ee3971567b76242d59c7b2b26d5`.
- Accepted actor-name compatibility addendum:
  `33deadd6c2127099823508e9ab3c74b544d1f0c3`.
- Compatibility acceptance token:
  `ACCEPT_B5A2A_COMPATIBILITY_ADDENDUM_AND_PUSH`.
- Current gate state: `HOLD_B5A2A_IMPLEMENTATION_GATE`.
- Amendment-authoring token:
  `GO_B5A2A_AGENCY_ID_PROP_TYPE_AMENDMENT_AUTHORING`.
- Maximum amendment remediation rounds: 2.

## Conflict resolved

`src/components/forms/subaccount-details.tsx` currently declares
`agencyDetails: Agency`, but its only runtime read of that prop is
`agencyDetails.id`. The three direct consumers therefore cannot accept the
minimal B5A2A projection without one of these forbidden outcomes:

- fetching and serializing a full Agency record;
- passing a full object through TypeScript structural compatibility;
- using `as Agency`, `as any`, a double cast, or another type lie; or
- introducing a broad wrapper or generic DTO.

The first compatibility addendum froze the whole component to protect the
legacy notification behavior. This amendment supersedes only that
byte-identical rule and replaces it with exact AST freezes around the runtime
behavior. Every other requirement in the accepted intake and first addendum
remains binding.

## Sole authorized type change

The later exact B5A2A implementation gate may authorize only this prop
narrowing:

```ts
agencyDetails: Readonly<{ id: string }>
```

It may also remove `Agency` from the existing Prisma type import when that
type becomes unused. `SubAccount`, its existing uses, the prop name, and every
runtime expression remain unchanged.

The ID value is a selector carried by an already authorized projection. It
does not grant authority: the receiving server mutation must continue to
resolve the immutable actor and prove agency ownership independently.

## Exact three-consumer contract

At the accepted addendum, exactly three source files render
`SubAccountDetails`:

| Consumer | Accepted canonical source hash | Required B5A2A mapping |
| --- | --- | --- |
| `src/components/sidebar/menu-options.tsx` | `sha256:6d11524df70dcdcd654cb0f53f61559903c3157b16cd1046c0304cac00b5bddc` | Construct a fresh ID-only object from the actor-authorized shell projection. |
| `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx` | `sha256:93e27857305cfb079a358e262520e0264a5711130deb6cde46428463bb06a388` | Construct a fresh ID-only object from the actor-authorized all-subaccounts projection. |
| `src/app/(main)/subaccount/[subaccountId]/settings/page.tsx` | `sha256:aa7de29c77676c90e1284f8ef07739c20234778a2d6439031018181377822944` | Construct a fresh ID-only object from the exact tenant-authorized settings projection. |

Each call site must pass an explicit fresh object with exactly the `id` key.
Passing a source DTO or ORM object directly is forbidden even when structural
typing would accept it. The object cannot contain an actor, role, name,
provider binding, billing identifier, customer identifier, address, logo,
permission, subaccount collection, or another agency field.

Source discovery must fail if a fourth consumer appears, a consumer passes a
non-literal/broad object, a cast appears, or a mapping is not derived from that
consumer's already-authorized B5A2A projection.

## Frozen component behavior

The accepted pre-change canonical file hash is:

`src/components/forms/subaccount-details.tsx`
`sha256:912f125c0c484642a089f3df5f493d889056e8828b86ce89cae45573161cc2fd`

Only the prop type and the now-unused `Agency` type-import specifier may differ
in B5A2A. The following SHA-256 digests are computed from normalized
TypeScript-AST node text and must remain exact:

| Frozen node | SHA-256 digest |
| --- | --- |
| `@/lib/queries` import containing `saveActivityLogsNotification` | `sha256:4e104e2d1d4f7ede1400313531afd4f8a2befb70cd0db4860e89a7a9a827656f` |
| `onSubmit` function declaration | `sha256:713140c5b26293b14b250533d726f46ef63ac7753571b169395b2b886a9b0fa8` |
| `saveActivityLogsNotification(...)` call expression | `sha256:183d9c7ec7e2adad335117e89d1b75c4d788e6d9cdb86fb2429148997e65854f` |
| `description` property assignment in that call | `sha256:6950341cf109439e1a01adb3b22f57d82cc5759da6f9d91bbf677b5222ae6806` |
| `saveActivityLogsNotification` declaration in `src/lib/queries.ts` | `sha256:5a5a1ccfbaa03dce8f4db75ed5a79a2cce43972be611f972e5bdba1e002c8f1c` |

The prop name, destructuring, default values, form schema, all runtime
branches, `upsertSubAccount` input, route refresh, toast behavior, loading and
error behavior, compatibility `userName`, notification call, notification
arguments, description, fallback, and result handling remain unchanged.

## Required fixed-input tests

The exact B5A2A gate must require AST/source and type fixtures that prove:

1. The component prop is exactly `Readonly<{ id: string }>` and not a generic,
   alias to a broader record, union with Agency, index signature, or optional
   ID.
2. `Agency` is not imported or referenced by the component after narrowing;
   no runtime Prisma import is introduced.
3. Exactly three direct consumers exist and each passes a freshly constructed
   object literal with exactly one `id` property.
4. Each ID originates from that consumer's server-authorized B5A2A projection;
   a route parameter, client form value, provider value, cookie, header,
   request value, or unrelated object fails verification.
5. Full Agency objects, object spreads, variables with extra keys,
   `as Agency`, `as any`, `as unknown as`, non-null assertions used to evade
   the contract, and broad compatibility wrappers fail verification.
6. Type fixtures accept a readonly valid ID reference and reject missing,
   optional, non-string, and extra-field object-literal agency references;
   runtime projection fixtures reject an empty ID before serialization.
7. The four component AST digests and the writer declaration digest remain
   exact after the type-only change.
8. A synthetic change to a mutation field, notification import/call/argument,
   description, fallback, branch, error behavior, or compatibility name causes
   verification to fail.
9. No notification/activity read, write, import, call, message, fallback,
   persistence behavior, or test expectation changes in B5A2A.
10. The first addendum's two compatibility-field paths, role restrictions,
    sole legacy Notification sink, and mandatory B5A2B removal remain exact.

Tests and evidence contain no agency IDs, actor names, emails, provider data,
source text, runtime payloads, environment values, credentials, or
representative data. Bounded repository-relative paths, counts, hashes, and
pass/fail identifiers are allowed.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| B5A2A-ID-01 | Only `agencyDetails: Readonly<{ id: string }>` and removal/narrowing of the unused Agency type import are authorized in `SubAccountDetails`. |
| B5A2A-ID-02 | Exactly three consumers pass fresh, exact ID-only object literals derived from their authorized B5A2A projections. |
| B5A2A-ID-03 | No full object, overfetch, spread, cast, generic DTO, wrapper, extra key, or structural-typing shortcut reaches the prop. |
| B5A2A-ID-04 | All runtime component behavior and every bound notification/activity AST digest remain exact. |
| B5A2A-ID-05 | Fixed AST/source/type fixtures reject consumer, origin, type, cast, overfetch, and runtime-behavior drift. |
| B5A2A-ID-06 | The first compatibility addendum remains intact except for its explicitly superseded byte-identical component rule. |
| B5A2A-ID-07 | Architect, Verifier, and Acceptance approve the same immutable amendment before implementation-gate authoring resumes. |

## Forbidden work and preserved holds

This amendment may add only this document and later review/lifecycle metadata.
It authorizes no production source, tests, inventory, scripts, package,
lockfile, Prisma, schema, SQL, permission DDL, provider, public route,
credential, network, representative data, deployment, release, re-theme,
CRM/Odoo, Composio, notification behavior, email/push, or agent-runtime work.

B5A2A production implementation, B5A2B, and B5A3-B5A8 remain blocked. The
dependency audit remains `STALE_UNREVALIDATED`, advisories remain `UNKNOWN`,
`CF-P1-AUDIT-FRESH-01` remains open, permission `userId` migration remains
`DESIGN_REQUIRED`, public/provider/representative-database evidence remains
blocked, and every readiness state remains `FAIL`.

## Rollback

Rollback removes only this amendment. It has no runtime, data, provider,
schema, package, notification, public, visual, CRM/Odoo, or deployment effect.

## Status

`READY`

## Execution gate

`BLOCKED`; B5A2A implementation-gate authoring cannot resume until Architect,
Verifier, and Acceptance approve this exact amendment candidate.
