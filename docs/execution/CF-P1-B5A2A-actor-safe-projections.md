# CF-P1-B5A2A — Actor-safe agency projections

## Checkpoint

- Immutable implementation parent:
  `bbe5ec82a8184c21fc0d09f767891c5dc7f08534`.
- Original held candidate: `30917ecfec561ed2beb1fc1929c9c5f809739aaf`.
- Remediation candidate: `8482550f03ddb5cb14d4aba411ec5877a5946248`.
- Remediation round: 1 of 2.
- Exact Architect and Verifier re-review: pending.
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

## Verification snapshot

At remediation candidate `8482550f03ddb5cb14d4aba411ec5877a5946248`:

- fixed B5A2A verifier: pass — 14 ledger records, seven projections, one client
  action, three details consumers, two logical compatibility sinks, and four
  entry calls;
- authority inventory: pass — 228 records, 21 database imports (20 direct and
  one injected), 52 server-action exports, 38 query exports, and manifest
  `sha256:c1e088fd578e83ff9e83effe72f8dd64c0063be2ceee17a00ac42ed91b80ac48`;
- focused suites: 40 passed, 338 expectations;
- complete suite: 337 passed, 1,694 expectations across 44 files;
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

This execution record grants no downstream authority. B5A2A advances only
after the architect and independent verifier approve the exact immutable
evidence-seal range and the acceptance orchestrator issues the next token.
