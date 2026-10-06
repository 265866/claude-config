### Orchestrate

Own a standing program through briefs, cross-run project facts, verification receipts, and a completion predicate. Use this for work that outlives one agent session. A single task belongs in autonomous-run; one ambitious run needing a bespoke procedure belongs in figure-it-out; a planning-only request belongs in multi-phase-plan. Choose execution using [the execution reference](../references/execution.md).

#### Roles and placement

- The coordinator frames scope, authors briefs, selects bounded execution runs, reconciles results, assigns integration work, and owns the user report. Code-writing units have a named owner. Routine local integration can be performed by the coordinator when it is in scope and cheap; do not hold completed work behind an unnecessary coordination layer.
- Workers own bounded assignments and return evidence or a blocker. They do not restart routing, duplicate the worker graph, or become additional schedulers.
- Use native independent batches, dependent phases, or bounded work/check cycles when their coordination warrants it; ordinary delegation fits a few small units. Give concurrent writers non-overlapping scopes or independent worktrees. Keep work that needs local state, configured browser access, or simulators on the available machine, with one live UI owner. Do not promise separate machines or remote dispatch.
- Independent review means a fresh context with a distinct adversarial lens. All default agents inherit the configured model and effort; do not claim a different model family.

#### Store and runtime

Use a user-named task directory, or `<project>/.claude/run-state/<run>/`, for explicit program artifacts. Keep the store out of version control unless the user asks to commit it. This is not automatic memory. Every mutable file has one owner. Keep generated one-off workflow scripts with these run artifacts; saving a reusable personal workflow needs proven repetition and an authorized profile-maintenance request.

Resolve the bundled runtime once:

```bash
bun "<profile>/tools/workflow/orch/orch.ts" --store "<store>" init
```

Run the same entrypoint with `--store <store>` for subsequent commands; this playbook writes that full invocation as `orch`, which is shorthand, not an installed command. Use `--help` on its subcommands when the exact argument shape is needed. The helper records project facts; it never launches, resumes, waits for, or wakes an agent. Native execution owns dependencies, active workers, retries, and returned results. Tasks displays coarse milestones; neither Tasks nor this ledger is a second scheduler.

The helper uses two kinds of lock. The store-level `.orch.lock` records its holder's PID. When that PID is dead, the helper replaces the lock automatically and says so on stderr. The global `--force` flag steals a lock whose holder is still alive; use it only after confirming that holder is not an active writer. Short per-file guard directories time out after five seconds and are never reclaimed automatically. If a writer was interrupted and its guard directory remains, verify that no writers still use that exact store or log before proposing removal of the error's exact guard path. Never remove a guard or force a lock to bypass a live writer.

- `preferences.md` records numbered standing orders. Add them with `orch standing add` rather than editing the file. Pass those orders into every new or resumed assignment.
- `overview.md` records program-level issues and references.
- `units.tsv` records cross-run project milestones: unit ID, track, state, branch, PR, head SHA, and brief path. Its state describes the deliverable, not a live agent.
- `ledger.tsv` records exact-head verification verdicts. A new head invalidates its earlier verdict.
- `gates.md` records decisions requiring authorization. There is no worker dispatch queue or completion inbox; native results return to the coordinator.
- `decisions.tsv` records meaningful choices through show-me-your-work.
- `status.md` is derived by the helper from current tables, not hand-maintained narration.
- `frontier.json` captures stack state when a stack is being managed. Its Graphite capture command requires an already-installed `gt` with authoritative metadata in that checkout. Do not invoke it without that prerequisite; ordinary unit/ledger bookkeeping does not require Graphite.

#### Brief contract

Every assignment includes the following information, scaled to its size:

```text
GOAL         Observable result.
SCOPE        Exclusive paths, worktree, branch and forbidden paths.
CONTEXT      Resolved file pointers and verified upstream findings.
ACCEPTANCE   Checkable behavior and boundary criteria.
VERIFY       Exact real checks, available control harness and known limitations.
BUDGET       Bounded rounds/retries, expected output and deadline when applicable.
FORBIDDEN    Unapproved ask-first actions and unit-specific restrictions.
REPORT       Status, artifact paths, branch/head, checks run and unresolved risks.
STANDING     Applicable user and program constraints.
```

Tell writers they share the codebase and must not revert others' work. A dependency is also a context handoff: relay verified upstream evidence to downstream workers. Missing acceptance criteria or ambiguous ownership must be resolved before spawning a writer. A small command does not need a page of ceremony.

#### Steps

1. Frame the countable done predicate, units, tracks, scope and resource budget. Route to autonomous-run if one agent could finish inside that budget. Schedule landing against the budget: by roughly 70% of it, stop starting new units and integrate what is verified, opening PRs, publishing a release, or landing only within an explicit grant. Record ask-first actions as gates. A time budget or autonomous run never approves an ask-first action; only the deployments CLAUDE.md says a standing full-permission grant covers are pre-approved.
2. Initialize the project store, standing orders, coarse task checklist and decision trail. For a sustained run explicitly requested by the user, use native /goal with the same predicate. Timed supervision is only for external waits or checks on live background work. Record whether scheduled checks are self-paced or fixed; self-paced checks need restarting after resume, while restored fixed cron tasks need inspection before replacement.
3. Pilot the first unit through implementation, checks, independent review when warranted, and local integration. Opening a PR, publishing a release, or landing occurs only within an explicit action grant. Fix the actual brief/check failures before scaling.
4. Execute independent units or dependent phases under the selected method, with resource and retry limits. Do not allocate more writers or verifiers than the machine and review capacity support. Keep in-flight units as a rolling window that one reconcile pass can review, refilling as units finish rather than waiting for the slowest unit of a whole batch. Stop the run before a choice that would override a design the user chose, another unresolved product decision, or an unapproved ask-first action; start the next stage after resolution rather than expecting mid-run user input.
5. Reconcile returned results at safe phase boundaries and before a user report. Record accepted project facts with `unit`, exact-head verdicts with `ledger`, approval gates with `gate`, and derived reporting with `status`. Failed, stopped, and missing results remain gaps. A result is evidence to validate, not permission to interrupt an atomic integration step.
6. Integrate verified units continuously within the authorized scope. A unit is done only when its output is recorded as it lands: committed locally on its branch, its ledger row written, and its receipts in the store. Do not batch this to the end of the run; work that exists only in a finished agent's worktree is not done. Keep one integrator per integration branch or stack. Pushing to the program's own branches and retargeting PRs it owns proceed and get reported. Opening PRs, replying, merging, and pushing to a shared branch the program did not create or one someone else owns require explicit approval, including for automatic loops.
7. Close by reconciling every child to a terminal state, verifying the predicate on the actual artifact, checking receipts against current heads, and delivering the store and evidence. Keep explicit task artifacts intact for the requested review.

#### Verification and liveness

Use worker checks for cheap deterministic units and fresh independent reviewers for judgment-heavy or consequential changes. A useful verdict distinguishes live UI verification, unit-test verification, type-check-only, blocked and failed; the ledger records these as `live-ui-verified`, `unit-test-verified`, `type-check-only`, `verifier-blocked`, and `verifier-failed`, mapped from worker statuses as the execution reference describes. CI green is evidence, not a complete verdict. Never mark blocked or stale evidence as PASS.

Give each running child an expected result and bounded budget. Native execution owns its progress and final result; reconcile every launched unit. Use actual run/task status, saved receipts, repository state, and bounded Monitor output for external background work. Do not send a message just to probe liveness because SendMessage resumes a completed agent. Native Monitor limits and availability are described in the execution reference (Supervision and time).

On a deadline, exhausted budget, or unexpected exit, record the last evidence and reconcile the unit before a bounded retry that addresses the observed failure. Retry by failure mode: a context or capacity limit respawns with a smaller scope, a network drop or transient tool failure retries as-is, a repeated tool error retries once with a revised brief, and an unknown failure retries once. After two retries, abandon the unit, record why, and replan around it. A late result must be checked against current files, frontier and verification receipts before acceptance. Never blindly merge it or turn a missing result into PASS.

When continued spawning would produce bad output across the program (broken upstream output, wrong acceptance criteria, dead infrastructure), add a stop order with `orch standing add "STOP: <cause>. Start no new units until a later order clears this."`, let in-flight work finish, fix the cause, then add a later order that clears it. Do not hand-edit `preferences.md`; the helper rejects any line that breaks its `N. text` numbering. Bound your own retries the same way: after a few consecutive tool failures and one revised approach that also fails, stop retrying, write a terminal handoff to the store (what is done, where it lives, and the exact command to resume), and end the run.

After restart, read standing orders and project facts, compare real branches/heads, and resume the recorded native session with `claude --resume <session-id>` when appropriate. Workflow replay is session-scoped; check artifacts and exact heads before relying on cached results. A fresh session starts a new run from verified remaining work. Restart self-paced checks and background process monitors; inspect restored fixed cron tasks before replacing expired or overdue tasks. Do not assume prior workers survived or repeat accepted external actions blindly.

#### Stack safety

The branch/base/head graph and exact-head receipts govern landing. One owner performs stack changes. Retargeting a chain the program owns and pushing its own branches with `--force-with-lease=<branch>:<sha you rewrote from>` (only while nobody else has pushed to them) proceed through that owner and get reported. Never close a base PR or push to a branch someone else owns as routine bookkeeping without approval. Read-only Git/GitHub queries may establish the graph; do not invent branch ancestry from old chat state.

For a Graphite-managed stack, use the optional frontier command only in the checkout with its authoritative metadata, and capture a new generation after each stack mutation. For another stack, record its real branch/base/PR relationships directly in program artifacts rather than pretending it has Graphite metadata.

#### Escalation

Reaches the user, batched into one report rather than per item: the ask-first actions in CLAUDE.md, product or preference calls no experiment settles, a standing order that contradicts observed reality, and a program-level dead end that survived a replan. Park each with `orch gate park <id> --question <question> --options <options> --default <recommended answer>` before asking, and route other work around it. Do not hand-edit `gates.md`; the helper parses it.

Never reaches the user: retries within budget, CI flake triage, review-thread triage (a reply itself stays an ask-first action; reruns and pushes to the program's own branches proceed), format fixes, scope the brief already forbids (refuse it and continue), and "should I keep going".

A mid-run discovery that blocks or degrades the program's goal becomes a unit. Anything else parks as a follow-up in `overview.md` rather than widening a current unit; at this fan-out a small scope leak multiplies into changes nobody asked for.

**Reply.** Predicate and counts from state, verified progress since the last report, current heads and verdicts, failed or abandoned work, concrete approval gates, and artifact paths. Do not repeat unchanged status tables.
