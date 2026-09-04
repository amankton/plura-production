# CF-P1-B5A2A — Subaccount-details boundary amendment

## Objective

Remove one unused actor prop and replace one broad Prisma-model prop with the
exact readonly data contract consumed by `SubAccountDetails`.

This is the final documentation-only component-boundary amendment required
before B5A2A implementation-gate authoring. It grants no source-change
authority.

## Immutable authority

- Accepted B5A2 intake:
  `90b0cdb0855a3ee3971567b76242d59c7b2b26d5`.
- Accepted legacy-name compatibility addendum:
  `33deadd6c2127099823508e9ab3c74b544d1f0c3`.
- Accepted agency-ID prop type amendment:
  `744163194cb4ef9d3bd10f1592dd91504009c4f4`.
- Agency-ID amendment acceptance token:
  `ACCEPT_B5A2A_AGENCY_ID_PROP_TYPE_AMENDMENT_AND_PUSH`.
- Current state: `HOLD_B5A2A_IMPLEMENTATION_GATE`.
- Authoring token:
  `GO_B5A2A_SUBACCOUNT_DETAILS_BOUNDARY_AMENDMENT_AUTHORING`.
- Maximum remediation rounds: 2.

## Exact boundary findings

At the accepted parent:

- `userId: string` is declared, destructured, and supplied by exactly three
  JSX consumers, but is never read by any runtime expression.
- `details?: Partial<SubAccount>` is a broad serialized-prop contract even
  though the component reads only ten subaccount fields.
- The two create-subaccount flows omit `details`; only the exact tenant
  settings projection supplies it.
- The accepted notification import, `onSubmit`, activity-writer call,
  description, and writer implementation do not need to change.

Keeping the dead actor ID would force data not authorized by the
all-subaccounts projection. Keeping `Partial<SubAccount>` would allow a broad
ORM object to cross the server/client boundary. A cast, wrapper, structural
typing shortcut, or overfetch is not an acceptable compatibility mechanism.

## Sole authorized component changes

The later exact B5A2A implementation gate may authorize only these changes in
`src/components/forms/subaccount-details.tsx`, in addition to the already
accepted agency-ID prop narrowing:

1. Remove the `userId: string` property signature.
2. Remove the dead `userId` component destructuring binding.
3. Replace `details?: Partial<SubAccount>` with an optional exact readonly
   purpose DTO containing only the fields below.
4. Remove `SubAccount` from the Prisma type import when it becomes unused.

The exact data shape is:

```ts
type SubaccountDetailsProjection = Readonly<{
  id: string
  name: string
  companyEmail: string
  companyPhone: string
  address: string
  city: string
  zipCode: string
  state: string
  country: string
  subAccountLogo: string
}>
```

The prop is exactly `details?: SubaccountDetailsProjection`. It is optional
because create flows supply no existing record, not because individual fields
may be absent. The type cannot extend, alias, intersect, union, or generic-wrap
a Prisma model and cannot have optional fields or an index signature.

The accepted `agencyDetails: Readonly<{ id: string }>` change remains exact.
The `userName` compatibility field and its frozen legacy persistence path
remain unchanged until B5A2B.

## Exact removed-node binding

The following normalized TypeScript-AST node hashes bind all and only the dead
`userId` flow that B5A2A may remove:

| Removed node | SHA-256 digest |
| --- | --- |
| `userId: string` property signature | `sha256:121cac71eb171184e3f395104c6beb19a87d4548707c5e4694f3efc5f114f82a` |
| `userId` destructuring binding | `sha256:6ccb21214ffd60b0fc2c1607cf6a05be6a0fed9c74819eb6a92e1bd6717b28eb` |
| `MenuOptions` JSX `userId` attribute | `sha256:5e6e5bf050db4795f497c01c5de32a94107cd03f1d6f2a32304e4feec2e47b76` |
| `CreateSubaccountButton` JSX `userId` attribute | `sha256:1a05fa0a541bf29cba62ae17212b3907c3ba87442534a6e24ff96fc3480d924c` |
| Subaccount settings JSX `userId` attribute | `sha256:7e7615bcebfd9047bfcc8a1523bdf926494c0050c1fdc519019507395ae6e688` |

The three caller files remain the only direct JSX consumers:

- `src/components/sidebar/menu-options.tsx`;
- `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx`; and
- `src/app/(main)/subaccount/[subaccountId]/settings/page.tsx`.

The B5A2A candidate must contain zero `userId` prop definitions, bindings, or
JSX attributes for `SubAccountDetails`. A fourth direct consumer fails closed.

## Frozen runtime nodes

The accepted pre-change component hash remains the baseline:

`sha256:912f125c0c484642a089f3df5f493d889056e8828b86ce89cae45573161cc2fd`

Apart from the agency-ID type amendment and the four component changes above,
the file is unchanged. These normalized AST node digests must remain exact:

| Frozen node | SHA-256 digest |
| --- | --- |
| `@/lib/queries` import containing `saveActivityLogsNotification` | `sha256:4e104e2d1d4f7ede1400313531afd4f8a2befb70cd0db4860e89a7a9a827656f` |
| `onSubmit` function declaration | `sha256:713140c5b26293b14b250533d726f46ef63ac7753571b169395b2b886a9b0fa8` |
| `saveActivityLogsNotification(...)` call expression | `sha256:183d9c7ec7e2adad335117e89d1b75c4d788e6d9cdb86fb2429148997e65854f` |
| Activity `description` property assignment | `sha256:6950341cf109439e1a01adb3b22f57d82cc5759da6f9d91bbf677b5222ae6806` |
| `saveActivityLogsNotification` declaration in `src/lib/queries.ts` | `sha256:5a5a1ccfbaa03dce8f4db75ed5a79a2cce43972be611f972e5bdba1e002c8f1c` |

The prop name `details`, default-value reads, form reset, form schema, every
runtime branch, `upsertSubAccount` input, server-derived agency reassessment,
route refresh, toast, loading, error, compatibility name, activity call,
activity arguments, description, fallback, and result behavior remain exact.

## Exact caller behavior

- Settings supplies a newly constructed readonly object containing exactly
  the ten allowlisted fields selected by the actor- and tenant-scoped B5A2A
  projection.
- `MenuOptions` and `CreateSubaccountButton` omit `details`, as they do for the
  current create flow.
- All three callers remove their now-dead `userId` JSX attribute.
- All three callers pass the fresh ID-only agency reference required by the
  accepted agency-ID amendment.
- No caller passes an ORM result, broad projection, object spread, cast,
  wrapper, unrelated value, route-derived ownership assertion, or extra key.

## Required fixed-input tests

The exact B5A2A gate must require AST/source, type, and synthetic projection
fixtures proving:

1. The exact readonly ten-field DTO is the only accepted `details` shape.
2. The settings adapter selects and serializes all and only those ten fields
   under `agencyId = context.agencyId AND id = context.subaccountId`.
3. Both create flows omit `details`; a caller-authored default record or route
   object fails verification.
4. Missing, optional, non-string, empty, or extra DTO fields are rejected by
   type fixtures, runtime projection validation, or the source allowlist as
   appropriate.
5. A Prisma `SubAccount` alias/import, generic, index signature, intersection,
   union, cast, spread, wrapper, structural full-object pass, or overfetch
   fails verification.
6. All five exact `userId` AST nodes are removed, no other node is removed for
   that reason, and no direct or indirect `userId` prop use survives.
7. Exactly three direct JSX consumers remain; a fourth or an unbound mapper
   fails source discovery.
8. The five frozen runtime-node hashes remain exact after the permitted type
   and dead-prop edits.
9. Synthetic mutation-input, notification-call, description, branch, fallback,
   error, or result drift fails verification.
10. The two prior amendments' ID-only agency reference, two legacy-name sinks,
    role exclusions, sole temporary Notification persistence path, and
    mandatory B5A2B removal remain exact.

Evidence contains only stable counts, repository-relative paths, hashes, and
pass/fail identifiers. It cannot contain source text, actor names, email,
agency/subaccount IDs, provider data, payloads, environment values,
credentials, stack traces, or representative data.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| B5A2A-BOUNDARY-01 | Only the dead `userId` declaration/binding/three attributes are removed. |
| B5A2A-BOUNDARY-02 | `details` is exactly an optional readonly ten-field purpose DTO and is not derived from a Prisma model. |
| B5A2A-BOUNDARY-03 | The settings projection supplies exactly the ten fields; both create flows omit the prop. |
| B5A2A-BOUNDARY-04 | All three callers use fresh ID-only agency references and no casts, wrappers, spreads, full objects, or overfetch. |
| B5A2A-BOUNDARY-05 | All notification/mutation runtime AST hashes and behavior remain exact. |
| B5A2A-BOUNDARY-06 | Fixed tests reject broad type, field, consumer, origin, removed-node, and runtime drift. |
| B5A2A-BOUNDARY-07 | Prior amendments remain binding except for the exact clauses superseded here. |
| B5A2A-BOUNDARY-08 | Architect, Verifier, and Acceptance approve one immutable amendment before B5A2A gate authoring resumes. |

## Superseded clauses

This amendment supersedes only earlier requirements that would keep:

- `SubAccountDetails.userId` and its three caller attributes;
- `details?: Partial<SubAccount>` or the related `SubAccount` type import; or
- those exact type/dead-prop nodes byte-identical.

It does not supersede any field maximum, compatibility-field restriction,
agency-ID narrowing, actor/tenant predicate, notification/activity freeze,
test, evidence, removal, hold, or forbidden-work requirement.

## Forbidden work and preserved holds

This amendment may add only this documentation file and later review/lifecycle
metadata. It authorizes no production source, tests, inventory, scripts,
package, lockfile, Prisma, schema, SQL, permission DDL, provider, public route,
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
