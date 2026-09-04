# CF-P1-B5A2A — Legacy activity actor-name compatibility addendum

## Objective

Permit one temporary, purpose-bound scalar so B5A2A can replace the broad
`getAuthUserDetails` graph without changing the legacy activity-writer
behavior that belongs to B5A2B.

This addendum is documentation-only. It does not authorize B5A2A production
implementation, notification changes, or any other source change.

## Immutable authority

- Accepted B5A2 intake:
  `90b0cdb0855a3ee3971567b76242d59c7b2b26d5`.
- B5A2 intake acceptance token: `ACCEPT_B5A2_INTAKE_AND_PUSH`.
- Superseded gate-authoring token: `GO_B5A2A_IMPLEMENTATION_GATE_AUTHORING`.
- Current implementation-gate state: `HOLD_B5A2A_IMPLEMENTATION_GATE`.
- Addendum-authoring token: `GO_B5A2A_COMPATIBILITY_ADDENDUM_AUTHORING`.
- Maximum addendum remediation rounds: 2.

## Conflict resolved

The accepted B5A2 intake correctly makes agency/subaccount shell projections
minimal and requires B5A2A to remove the broad actor/agency graph. It also
freezes notification/activity behavior until B5A2B.

Two create-subaccount flows currently pass the exact local actor's name to
`SubAccountDetails.userName`, which uses it only inside the arbitrary legacy
activity description:

1. `Sidebar` → `MenuOptions` → `SubAccountDetails`.
2. All-subaccounts page → `CreateSubaccountButton` → `SubAccountDetails`.

Removing, emptying, replacing, or re-resolving that value in B5A2A would alter
the frozen B5A2B behavior or add a new identity surface. Retaining the broad
User graph would violate B5A2A. This addendum closes only that conflict.

The subaccount settings page also supplies `SubAccountDetails.userName`, but
its accepted settings projection already permits actor `name`. It is not a
consumer of the compatibility field authorized here.

## Sole compatibility field

B5A2A may add this one optional projection property:

```ts
legacyActivityActorName?: string
```

The property is an exception only to the B5A2 intake's agency shell,
subaccount shell, and all-subaccounts maximum-field rows. Every other field,
predicate, denial, DTO, and serialization bound remains unchanged.

The value:

- is selected from the same exact local actor already resolved server-side;
- is present only when that actor is `AGENCY_OWNER` or `AGENCY_ADMIN` and the
  projection exposes an existing create-subaccount capability;
- is absent for `SUBACCOUNT_USER`, `SUBACCOUNT_GUEST`, unauthenticated,
  unprovisioned, null-agency, denied, and tenant-free onboarding outcomes;
- is never accepted from the client, provider profile/metadata, email,
  request, route, cookie, header, or another actor record;
- is mapped only to the unchanged `SubAccountDetails.userName` property in the
  two source-to-sink flows above;
- never participates in identity, role, permission, authorization, ownership,
  tenant selection, persistence predicates, query keys, cache keys, routing,
  logging, error handling, or another UI display; and
- cannot be re-exported through a generic actor/user DTO or queried through a
  new action, route, loader, callback, or provider call.

No other compatibility field or scalar is implied.

## Exact source-to-sink binding

These hashes are SHA-256 digests of canonical Git content at the accepted
intake. The B5A2A gate must bind them and its tests must fail on an unlisted
compatibility consumer.

| Role | Repository path | Accepted source hash |
| --- | --- | --- |
| Agency/subaccount shell source | `src/components/sidebar/index.tsx` | `sha256:3e173c19a45cbb587d1a84740d30c8a839a537fa5461e88704203736b9a78543` |
| First compatibility mapper | `src/components/sidebar/menu-options.tsx` | `sha256:6d11524df70dcdcd654cb0f53f61559903c3157b16cd1046c0304cac00b5bddc` |
| All-subaccounts source | `src/app/(main)/agency/[agencyId]/all-subaccounts/page.tsx` | `sha256:96ab560857c70226dab4a32e54b932dbd995ac12b7511aa2ef694842df863c54` |
| Second compatibility mapper | `src/app/(main)/agency/[agencyId]/all-subaccounts/_components/create-subaccount-btn.tsx` | `sha256:93e27857305cfb079a358e262520e0264a5711130deb6cde46428463bb06a388` |
| Frozen sink and legacy payload | `src/components/forms/subaccount-details.tsx` | `sha256:912f125c0c484642a089f3df5f493d889056e8828b86ce89cae45573161cc2fd` |

`src/components/forms/subaccount-details.tsx` must remain byte-identical in
B5A2A. The `saveActivityLogsNotification` declaration in
`src/lib/queries.ts` must retain this TypeScript-AST node digest:

`sha256:5a5a1ccfbaa03dce8f4db75ed5a79a2cce43972be611f972e5bdba1e002c8f1c`

The full `src/lib/queries.ts` hash may change only because B5A2A removes its two
owned broad projection exports. The activity writer's declaration, input,
fallback, payload, message, write, and behavior remain frozen for B5A2B.

## Required source and role tests

The exact B5A2A gate must require fixed-input tests that prove:

1. `legacyActivityActorName` appears in only the projection declaration,
   server mapping, and the two allowlisted source-to-sink paths.
2. No action, API route, provider callback, public loader, or client input can
   request, set, override, or independently retrieve it.
3. Owner/admin success maps the persisted exact-actor value without widening
   the projection to another User field.
4. Guest, `SUBACCOUNT_USER`, onboarding, anonymous, unprovisioned,
   null-agency, cross-agency, missing, duplicate, and denied cases serialize no
   compatibility property.
5. A different user record, provider name, email-derived record, route value,
   request value, or caller value can never become the property.
6. The value is consumed only as the existing `SubAccountDetails.userName`
   prop in both allowlisted create-subaccount paths.
7. The subaccount settings page continues to use its already accepted bounded
   actor-profile `name` and does not import or consume the compatibility field.
8. `SubAccountDetails` remains byte-identical and the activity-writer AST
   digest remains exact.
9. The B5A2A candidate changes zero notification/activity imports, calls,
   arguments, descriptions, messages, fallbacks, reads, writes, tests, or
   runtime behavior.
10. A synthetic extra property, role, consumer, mapper, provider lookup,
    callable surface, or writer drift causes the focused verification to fail.

Evidence may contain only stable counts, repository-relative paths, hashes,
and pass/fail identifiers. It cannot emit actor names, emails, provider data,
source text, payloads, runtime identifiers, environment values, credentials,
or representative data.

## Mandatory B5A2B removal

B5A2B must remove:

- `legacyActivityActorName` from every projection and type;
- both compatibility mappings into the create-subaccount sinks; and
- the subaccount-settings actor-name mapping used only by the same legacy
  activity description,

when it removes the generic client-callable activity writer and all UI
follow-up calls. B5A2 cannot close while the compatibility property or any
consumer remains. No later B5A3-B5A8 child may inherit it.

## Acceptance criteria

| ID | Pass/fail criterion |
| --- | --- |
| B5A2A-COMPAT-01 | Exactly one optional property named `legacyActivityActorName` is authorized; no other intake field bound changes. |
| B5A2A-COMPAT-02 | The value is derived only from the exact server-resolved persisted actor and is absent outside owner/admin create-subaccount projections. |
| B5A2A-COMPAT-03 | Exactly two create-subaccount source-to-sink paths consume the property and only through `SubAccountDetails.userName`. |
| B5A2A-COMPAT-04 | The property has zero authority, ownership, persistence-key, route, cache, error, logging, provider, and independent-callable use. |
| B5A2A-COMPAT-05 | `SubAccountDetails` remains byte-identical and the legacy activity-writer AST digest remains exact throughout B5A2A. |
| B5A2A-COMPAT-06 | Fixed synthetic role, source-discovery, serialization, and drift tests reject every unauthorized presence, source, sink, or use. |
| B5A2A-COMPAT-07 | B5A2B removal is an explicit hard completion condition for the parent B5A2 lifecycle. |
| B5A2A-COMPAT-08 | Architect, Verifier, and Acceptance approve the same immutable addendum before B5A2A implementation-gate authoring resumes. |

## Forbidden work and preserved holds

This addendum may add only this documentation file and later review/lifecycle
metadata. It authorizes no production source, test, inventory, script,
package, lockfile, Prisma, schema, SQL, permission DDL, provider, public route,
credential, network, representative data, deployment, release, re-theme,
CRM/Odoo, Composio, notification, email/push, or agent-runtime change.

B5A2A production implementation, B5A2B, and B5A3-B5A8 remain blocked. The
dependency audit remains `STALE_UNREVALIDATED`, advisories remain `UNKNOWN`,
`CF-P1-AUDIT-FRESH-01` remains open, permission `userId` migration remains
`DESIGN_REQUIRED`, public/provider/representative-database evidence remains
blocked, and every readiness state remains `FAIL`.

## Rollback

Rollback removes only this addendum. It has no runtime, data, provider, schema,
package, public, notification, visual, CRM/Odoo, or deployment effect.

## Status

`READY`

## Execution gate

`BLOCKED`; B5A2A implementation-gate authoring cannot resume until Architect,
Verifier, and Acceptance approve this exact addendum candidate.
