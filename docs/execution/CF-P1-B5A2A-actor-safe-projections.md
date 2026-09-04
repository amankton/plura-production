# CF-P1-B5A2A — Actor-safe agency projections

## Checkpoint

- Immutable implementation parent:
  `bbe5ec82a8184c21fc0d09f767891c5dc7f08534`.
- Original held candidate: `30917ecfec561ed2beb1fc1929c9c5f809739aaf`.
- Production implementation candidate:
  `8482550f03ddb5cb14d4aba411ec5877a5946248`.
- Prior review seal: `4d80995620b52ee3ba2f6783c248fa50d1fc9681`.
- Final remediation candidate: `7832c703ddbc2d527d83b2a810d8f6890db9fdca`.
- Final reviewed evidence seal:
  `e49214949fcacdb6b9e3b8cb1e6478bb177986dc`.
- Remediation round: 2 of 2.
- Architect review: `APPROVE_B5A2A_IMPLEMENTATION_CANDIDATE`.
- Independent verification: `PASS_B5A2A_IMPLEMENTATION_CANDIDATE`.
- Acceptance: `ACCEPT_B5A2A_IMPLEMENTATION_CANDIDATE_AND_PUSH`.
- Execution-seal authoring clearance: `GO_B5A2A_EXECUTION_SEAL_AUTHORING`.
- Branch: `codex/crewframe-foundation`.

## Outcome

B5A2A replaces the two broad legacy account reads and both settings-page
database imports with seven purpose-specific server projections and one exact
ticket-assignee client action. The new boundary derives actor, agency, and
subaccount authority on the server, selects only declared DTO fields, and
maps adapter records into fresh objects before returning them.

The exact 14-row old-to-new ledger is recorded in the candidate evidence.
All 14 rows close as an explicit removal, replacement, or byte-exact/bounded
retention. The two B5A2B notification/activity declarations remain unchanged.

## Remediation round 1

The held candidate was corrected without opening downstream scope:

- all eight collection reads use a 251st-row sentinel and the pure service
  rejects overflow before mapping, sorting, or duplicate evaluation;
- ticket assignees are loaded beneath one exact agency-owned subaccount root,
  so an existing tenant with zero assignees is distinguishable from a target
  deleted, replaced, or orphaned after context resolution;
- agency and subaccount settings use selector-only `id` and `name` reads;
- the temporary legacy activity name is display-only and cannot hide or grant
  the owner/admin create-subaccount capability;
- the inventory classifies service composition as read-only with no write
  authority; and
- fixed injected-source and whole-remainder mutations prove rejection of the
  prohibited imports, types, casts, wrappers, spreads, extra consumers,
  compatibility sinks, entry calls, client actions, and legacy drift.

## Remediation round 2

The final bounded remediation changes test evidence only. It mutates all 100
protected top-level statements across the three writable legacy files,
including every one of the 38 retained query exports, and separately mutates
21 provisioning, upsert, Stripe, delete, goal-update, toast, refresh, cleanup,
and error-path markers in `AgencyDetails`. Every fixed in-memory mutation is
rejected by the same normalized remainder functions used by the repository
verifier. Production source remains byte-exact to the round-one implementation.

## Verification snapshot

At final remediation candidate `7832c703ddbc2d527d83b2a810d8f6890db9fdca`:

- fixed B5A2A verifier: pass — 14 ledger records, seven projections, one client
  action, three details consumers, two logical compatibility sinks, and four
  entry calls;
- authority inventory: pass — 228 records, 21 database imports (20 direct and
  one injected), 52 server-action exports, 38 query exports, and manifest
  `sha256:c1e088fd578e83ff9e83effe72f8dd64c0063be2ceee17a00ac42ed91b80ac48`;
- focused suites: 42 passed, 464 expectations;
- complete suite: 339 passed, 1,820 expectations across 44 files;
- lint, typecheck, production build, and 13-page static generation: pass;
- frozen offline install: 895 installs across 705 packages, no changes; and
- diff, allowlist, protected-file, secret/PII/log/provider/schema/package,
  public-route, and deployment scans: pass.

The complete normalized remainder hashes, source hashes, protected Git blobs,
command outcomes, and zero-use declarations are recorded in
`docs/evidence/CF-P1-B5A2A-candidate-verification.json`.

## Scope and holds

Verification used only repository content and fixed synthetic in-memory
adapters. It accessed no network service, provider, credential,
representative database, or representative data. It changed no schema,
package or lockfile, public route, notification/activity behavior, provider
configuration, deployment surface, or readiness state, and added no
production log.

The dependency audit remains `STALE_UNREVALIDATED`, advisories remain
`UNKNOWN`, and `CF-P1-AUDIT-FRESH-01` remains open. Permission migration
remains `DESIGN_REQUIRED`. All readiness states remain `FAIL`. B5A2B and
B5A3–B5A8, re-theme/taste validation, and the CRM/Odoo introduction remain
blocked pending their own exact gates.

## Rollback posture

Revert only the B5A2A candidate range to restore the accepted gate parent.
The checkpoint made no database write, schema migration, provider mutation,
public publication, or deployment, so it requires no data or external-system
rollback.

This execution record grants no downstream authority. The exact implementation
and evidence range has passed architect, verifier, and acceptance review.
B5A2A advances only after this documentation-only child receives
`PASS_B5A2A_EXECUTION_SEAL` and Acceptance authorizes the separate lifecycle
transition.
