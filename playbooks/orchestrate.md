### Orchestrate

Own a standing program through briefs, cross-run project facts, verification receipts, and a completion predicate. Use this for work that outlives one agent session. A single task belongs in autonomous-run; one ambitious run needing a bespoke procedure belongs in figure-it-out; a planning-only request belongs in multi-phase-plan. Choose execution using [the execution reference](../references/execution.md).

#### Roles and placement

- The coordinator frames scope, authors briefs, selects bounded execution runs, reconciles results, assigns integration work, and owns the user report. Code-writing units have a named owner. Routine local integration can be performed by the coordinator when it is in scope and cheap; do not hold completed work behind an unnecessary coordination layer.
- Workers own bounded assignments and return evidence or a blocker. They do not restart routing, duplicate the worker graph, or become additional schedulers.
- Use native independent batches, dependent phases, or bounded work/check cycles when their coordination warrants it; ordinary delegation fits a few small units. Give concurrent writers non-overlapping scopes or independent worktrees. Keep work that needs local state, configured browser access, or simulators on the available machine, with one live UI owner. Do not promise separate machines or remote dispatch.
- Independent review means a fresh context with a distinct adversarial lens. All default agents inherit the configured model and effort unless CLAUDE.md allows another choice. Do not claim a model family an agent did not run on.

#### Store and runtime

Use a user-named task directory, or `<project>/.claude/run-state/<run>/`, for explicit program artifacts. Keep the store out of version control unless the user asks to commit it: when it sits inside a repository's working tree, add its directory, relative to the worktree root with a leading `/`, to the file `git rev-parse --git-path info/exclude` names. `decisions.tsv` is the exception. Inside the project's working tree it follows show-me-your-work's commit rule, staged with `git add -f -- <path>` despite that exclude line; in a store outside it, it is delivered with the store at step 7. This is not automatic memory. Every mutable file has one owner. Keep generated one-off workflow scripts with these run artifacts; saving a reusable personal workflow needs an authorized profile-maintenance request (a user's explicit request to save it is one); propose saving one on your own initiative only after proven repetition.

The store is plain files that the coordinator alone writes. It edits each file directly, except `decisions.tsv`, which it appends through decision-log. Workers return results and never write the store, so it needs no lock. The store records project facts. It never launches, resumes, waits for, or wakes an agent. Native execution owns dependencies, active workers, retries, and returned results. Tasks displays coarse milestones; neither Tasks nor this ledger is a second scheduler.

- `preferences.md` records numbered standing orders, one `N. text` line each. Append each new order with the next number. Never renumber, edit, or delete an earlier order; a later order supersedes it. Pass those orders into every new or resumed assignment.
- `overview.md` records program-level issues, follow-ups, and references.
- `units.tsv` records cross-run project milestones, one row per unit with the tab-separated columns `id`, `track`, `state`, `branch`, `base`, `pr`, `sha`, and `brief` (unit ID, track, state, branch, base branch, PR, head SHA, and brief path) under a header line of those names. Its state describes the deliverable, not a live agent. For a stack, `branch`, `base`, and `pr` hold its real relationships.
- `ledger.tsv` records exact-head verification verdicts, one row per verdict with the tab-separated columns `pr`, `sha`, `verdict`, `evidence`, `verifier`, and `ts` under a header line of those names. `verdict` holds one of the evidence levels under Verification and liveness. A new head invalidates its earlier verdict.
- `gates.md` records decisions requiring authorization, each with its question, options, recommended default, and whether it is open or resolved. There is no worker dispatch queue or completion inbox; native results return to the coordinator.
- `decisions.tsv` records meaningful choices through show-me-your-work's `bun "<profile>/tools/workflow/decision-log.ts"`.

There is no status file. Each report reads its counts from these tables.

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

Each brief names the evidence that proves the unit is done, such as a command and its expected output, a control-harness check, or an artifact. If you cannot name it, the unit is not scoped yet. Tell writers they share the codebase and must not revert others' work. A dependency is also a context handoff: relay verified upstream evidence to downstream workers. Missing acceptance criteria or ambiguous ownership must be resolved before spawning a writer. A small command does not need a page of ceremony.

#### Steps

1. Frame the countable done predicate, units, tracks, scope and resource budget. Route to autonomous-run if one agent could finish inside that budget. Schedule landing against the budget: by roughly 70% of it, stop starting new units and integrate what is verified, opening PRs, publishing a release, or landing only within an explicit grant. Record ask-first actions as gates. A time budget or autonomous run never approves an ask-first action; only the deployments CLAUDE.md says a standing full-permission grant covers are pre-approved.
2. Initialize the project store, standing orders, coarse task checklist and decision trail. For a sustained run explicitly requested by the user, use native /goal with the same predicate. Timed supervision is only for external waits or checks on live background work. Record whether scheduled checks are self-paced or fixed; self-paced checks need restarting after resume, while restored fixed cron tasks need inspection before replacement.
3. Pilot the first unit through implementation, checks, independent review when warranted, and local integration. Opening a PR, publishing a release, or landing occurs only within an explicit action grant. Fix the actual brief/check failures before scaling.
4. Execute independent units or dependent phases under the selected method, with resource and retry limits. Do not allocate more writers or verifiers than the machine and review capacity support. Keep in-flight units as a rolling window that one reconcile pass can review, refilling as units finish rather than waiting for the slowest unit of a whole batch. Hold the units that depend on a choice that would override a design the user chose, another unresolved product decision, or an unapproved ask-first action; independent units continue, and the dependent stage starts after resolution rather than expecting mid-run user input.
5. Reconcile returned results at safe phase boundaries and before a user report. Record accepted project facts in `units.tsv`, exact-head verdicts in `ledger.tsv`, and approval gates in `gates.md`. Before reporting on a PR, read its live state with `bun "<profile>/tools/workflow/watch-pr/watch-pr.ts" --owner <owner> --repo <repo> --pr <number> --status-only` rather than trusting a worker's last report. Failed, stopped, and missing results remain gaps. A result is evidence to validate, not permission to interrupt an atomic integration step.
6. Integrate verified units continuously within the authorized scope. A unit is done only when its output is recorded as it lands: committed locally on its branch, its ledger row written, and its receipts in the store. Do not batch this to the end of the run; work that exists only in a finished agent's worktree is not done. Keep one integrator per integration branch or stack. Pushing to the program's own branches, fast-forward pushes to a PR branch the user authored and handed over, and retargeting PRs it owns proceed and get reported. Opening PRs, replying, merging, and pushing to a default or protected branch, to a shared branch that neither the program nor the user created, or to one someone else or a bot owns, require explicit approval, including for automatic loops.
7. Close by reconciling every child to a terminal state, verifying the predicate on the actual artifact, checking receipts against current heads, and delivering the store and evidence. Keep explicit task artifacts intact for the requested review.

#### Verification and liveness

Use worker checks for cheap deterministic units and fresh independent reviewers for judgment-heavy or consequential changes. A useful verdict distinguishes live UI verification, unit-test verification, type-check-only, blocked and failed; the ledger records these as `live-ui-verified`, `unit-test-verified`, `type-check-only`, `verifier-blocked`, and `verifier-failed`, mapped from worker statuses as the execution reference describes. CI green is evidence, not a complete verdict. Never mark blocked or stale evidence as PASS.

When the user pauses, follow [Pause safely](pause-safely.md). When the user withdraws authorization for a unit or the program, apply the withdrawal rules in [Autopilot full](autopilot-full.md). Set each withdrawn unit's `state` in `units.tsv` to `withdrawn`, and each unit blocked by withdrawal to `blocked-by-withdrawal`. For each such unit, list its withdrawn or blocked-by-withdrawal files, half-done operations, and prior state in `overview.md`, which together with `units.tsv` is this program's ledger for resume marks.

Give each running child an expected result and bounded budget. Native execution owns its progress and final result; reconcile every launched unit. Use actual run/task status, saved receipts, repository state, and bounded Monitor output for external background work. Do not send a message just to probe liveness because SendMessage resumes a completed agent. Native Monitor limits and availability are described in the execution reference (Supervision and time).

On a deadline, exhausted budget, or unexpected exit, record the last evidence and reconcile the unit before a bounded retry that addresses the observed failure. Each retry follows the execution reference's fresh-agent rule, with the consolidated brief. Retry by failure mode: a context or capacity limit shrinks the scope, a network drop or transient tool failure keeps the scope unchanged, and a repeated tool error retries once with a revised brief. Inspect an unknown failure first, and retry it once only when the inspection finds a recoverable cause. Otherwise, or after two retries, abandon the unit, record why, and replan around it. A late result must be checked against current files, branch/base/head state, and verification receipts before acceptance. Never blindly merge it or turn a missing result into PASS.

When continued spawning would produce bad output across the program (broken upstream output, wrong acceptance criteria, dead infrastructure), append a stop order to `preferences.md`, `N. STOP: <cause>. Start no new units until a later order clears this.`, let in-flight work finish, fix the cause, then append a later order that clears it. Bound your own retries the same way: after a few consecutive tool failures and one revised approach that also fails, stop retrying, write a terminal handoff to the store (what is done, where it lives, and the exact command to resume), and end the run.

After restart, read standing orders and project facts. Resume the recorded native session with `claude --resume <session-id>` when appropriate, then follow [Session pickup](session-pickup.md), including its step 3 resume marks. Do not assume prior workers survived or repeat accepted external actions blindly.

#### Stack safety

The branch/base/head graph and exact-head receipts govern landing. One owner performs stack changes. Retargeting a chain the program owns and pushing its own branches with `--force-with-lease=<branch>:<sha you last pushed to it>` (only while nobody else has pushed to them) proceed through that owner and get reported. Never close a base PR or push to a branch someone else owns as routine bookkeeping without approval. Read-only Git/GitHub queries may establish the graph; do not invent branch ancestry from old chat state.

Record the stack's real branch/base/PR relationships in `units.tsv`, read from Git and `gh`, and update them after each stack mutation.

#### Escalation

Reaches the user, batched into one report rather than per item: the ask-first actions in CLAUDE.md, product or preference calls no experiment settles, a standing order that contradicts observed reality, and a program-level dead end that survived a replan. Park each in `gates.md`, with its question, options, and recommended default, before asking, and route other work around it.

Never reaches the user: retries within budget, CI flake triage, review-thread triage (an `ask` result from the review-bot triage reference, or a requested change Babysit sends to the user, escalates as above; a reply itself stays an ask-first action unless an existing approval covers it; reruns and pushes to the program's own branches proceed), format fixes, scope the brief already forbids (refuse it and continue), and "should I keep going".

A mid-run discovery that CLAUDE.md (Authorization and ownership) puts in scope, a proven defect in the program's deliverable or one that blocks or degrades its goal, becomes a unit. Anything else parks as a follow-up in `overview.md` rather than widening a current unit; at this fan-out a small scope leak multiplies into changes nobody asked for.

**Reply.** Predicate and counts from state, verified progress since the last report, current heads and verdicts, failed or abandoned work, concrete approval gates, and artifact paths. Do not repeat unchanged status tables.
