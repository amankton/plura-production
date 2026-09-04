# CF-P1-B5A2B — Notification visibility and activity-writer retirement

## Checkpoint

- Immutable implementation parent:
  `7f236cbba1281c0bdaccbfa6770fcc0c128a4f80`.
- Documentation gate draft: `0d28d0dffa4e3a4fa078beaf6cc5881f891a7211`.
- Accepted gate: `1b3b36256629d3aaae567ffb66a351ece036359e`.
- Original implementation candidate:
  `df9d73353f52bca948f5e718bf7dd7dd5998ab0f`.
- Remediation-one candidate: `c78cfaeff36b8f6fd0fc260d5197f3ecf197e00e`.
- Final remediation candidate: `d0f6539dce86dbf68eadf9457893c0b38bd5bad1`.
- Remediation usage: 2 of 2.
- Architect review: `APPROVE_B5A2B_REMEDIATION_CANDIDATE`.
- Independent verification: `PASS_B5A2B_REMEDIATION_CANDIDATE`.
- Acceptance: `ACCEPT_B5A2B_REMEDIATION_CANDIDATE`.
- Evidence authoring clearance: `GO_B5A2B_EVIDENCE_EXECUTION_SEAL_AUTHORING`.
- Branch: `codex/crewframe-foundation`.

## Outcome

B5A2B removes the two broad legacy notification/activity server actions. The
two notification consumers now use actor-derived server views with exact
agency or subaccount persistence predicates, a closed role/action matrix, a
100-item result bound with a 101st-row overflow sentinel, deterministic
ordering, strict ownership validation, and a fresh allowlisted DTO.

All 16 legacy activity-writer imports and all 18 follow-up calls are removed.
Their authoritative owning mutations, arguments, order, result handling, and
unrelated UI branches remain protected by normalized whole-remainder checks.
No live replacement event or production Notification write was added.

The temporary B5A2A actor-name compatibility chain is also removed across its
eight files. The accepted actor-profile name remains available to its intended
profile consumer, but the activity-only query, helper, projection, mapping,
prop, and sink no longer exist.

## Dormant foundation

The new activity foundation remains deliberately unwired. Production has zero
event registrations, templates, adapters, callers, workers, schedules,
routes, actions, or writes. Its strict factory accepts only an injected finite
registry and atomic create-once store. Synthetic tests prove one valid write,
idempotent duplicate handling, finite conflict containment, rollback, exact
receipt cardinality, ownership matching, bounded plain text, strict keys, and
rejection of unknown adapter outcomes.

Thirteen independently named source injections prove the fixed verifier rejects
a production registry/event definition, domain event literal, adapter, server
action, route handler, authoritative-mutation-side caller, provider import,
worker runtime, scheduler runtime, each of create/upsert/update, and a
production foundation importer.

## Remediation round 1

The first held candidate was corrected without expanding scope:

- both notification persistence failures now become the finite conflict
  outcome;
- renderer exceptions and unrecognized activity-store results are contained;
- behavioral server-adapter tests prove role branching, policy-before-query
  order, exact selectors, and zero queries for denied actors;
- all 16 imports and 18 calls, every protected writer statement and call, the
  complete action-policy selection path, and all six privileged-name controls
  are independently mutated; and
- dormant-foundation denial coverage closes foreign scope, malformed context,
  stale/zero/multiple rows, bounded-label, renderer, unknown-result, conflict,
  duplicate, and rollback cases.

## Remediation round 2

The final remediation is tests/tooling only. It adds the complete 13-case
dormant production-reachability matrix. The fixed verifier was strengthened to
reject a production call to the dormant factory and unquoted production event
identifiers. No existing hash, allowlist, source discovery, policy assertion,
or negative check was weakened, and production source stayed byte-exact to the
round-one implementation.

## Verification snapshot

At final candidate `d0f6539dce86dbf68eadf9457893c0b38bd5bad1`:

- B5A2B fixed verifier: pass — 2 legacy records, 2 readers, 16 retired writer
  imports, 18 retired writer calls, 8 compatibility files, feed bound 100, and
  0 production events;
- B5A2A fixed verifier: pass — 14 records, 7 projections, 1 client action, 3
  consumers, 0 remaining compatibility sinks, and 4 entry calls;
- authority inventory: pass — 231 records, 22 database boundaries (21 direct
  and 1 injected), 50 server exports, 36 query exports, and manifest
  `sha256:073ec09f33f304352df5f6f262a4e197c2139c11788dff113745593b414c7258`;
- focused suites: 71 passed with 1,354 expectations across 6 files;
- complete suite: 368 passed with 2,710 expectations across 47 files;
- mutation proof: 28 source-boundary, 13 named dormant-reachability, 18 policy
  and selection, 16 writer-import, 18 writer-call, 296 protected-statement,
  328 protected-call, and 6 privileged-control mutations;
- lint, typecheck, isolated production build, and 13-page static generation:
  pass;
- frozen offline install: 895 installs across 705 packages, no changes; and
- diff, exact allowlist, protected-remainder, secret/PII/log/network/provider,
  schema/package, public-route, and deployment scans: pass.

The complete SHA chain, source hashes, protected Git blobs, command outcomes,
inventory reconciliation, mutation counts, and zero-use declarations are in
`docs/evidence/CF-P1-B5A2B-candidate-verification.json`.

Two concurrent independent Next builds briefly contended for the shared
generated `.next` directory. Once the competing process exited, an unchanged-
SHA isolated build completed successfully. No tracked file changed during the
contention.

## Scope and holds

Verification used only repository content and fixed synthetic in-memory
adapters. It accessed no network service, provider, credential,
representative database, or representative data. It changed no schema,
package or lockfile, public route, provider configuration, deployment surface,
re-theme, CRM/Odoo boundary, Composio integration, agent runtime, or readiness
state, and added no production log.

The dependency audit remains `STALE_UNREVALIDATED`, advisories remain
`UNKNOWN`, and `CF-P1-AUDIT-FRESH-01` remains open. Permission migration
remains `DESIGN_REQUIRED`. Representative provider/database work, public
runtime, deployment, and every readiness state remain blocked or `FAIL`.
B5A3–B5A8, re-theme/taste validation, CRM/Odoo introduction, Composio, and
agent-runtime work remain blocked pending their own exact gates.

## Rollback posture

Revert only the B5A2B implementation candidate range to restore the accepted
implementation parent. This checkpoint made no representative database write,
schema migration, provider mutation, public publication, or deployment, so it
requires no data or external-system rollback.

This record grants no downstream authority. The documentation-only seal must
receive `APPROVE_B5A2B_EXECUTION_SEAL` and `PASS_B5A2B_EXECUTION_SEAL` before
Acceptance can authorize a separate lifecycle transition or push.
