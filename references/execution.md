# Execution mechanics

The main coordinator selects the procedure and execution method using CLAUDE.md. Read the relevant sections here when coordinating work. Domain skills still own their required checks, independence, evidence, and acceptance criteria. These mechanics do not replace those requirements.

## Frame the run

Record the authorized outcome, input revision or source scope, required work units, dependency order, owned resources, verification boundary, and stopping point. Define a finite worker/round budget and an observable deadline when work can stall. Count investigation, implementation, review, retries, and synthesis in that budget.

Prefer an existing deterministic command for a known transformation. Validate a newly authored transformation like any other code change. A long wait or a large file count alone does not require agent orchestration.

Use one executor per run. Native Workflow schedules its nodes; an ordinary coordinator owns a smaller delegated run. Native Tasks shows the matched playbook's steps and other coarse milestones. Keep design and acceptance in the Markdown plan rather than copying runtime node status into a second checklist.

Stop at an unresolved product or preference decision (including overriding a design the user chose) or an unapproved ask-first action in CLAUDE.md (Authorization and ownership). A proven defect, failing check, or reviewer finding is none of these, except an `ask` result below; resolve it within the run: repair what is proven and in scope, report proven defects outside it, classify automated-review findings with references/review-bot-triage.md (an `ask` result is a decision that ends the run like those above), and dismiss disproven findings with evidence. Investigate other unproven findings until they are proven or disproven, or report them as unverified. Prepare the evidence and recommendation, return to the main conversation, and begin the next run only when that decision is resolved. Orchestration authorization is not approval for an ask-first action.

## Independent batches

Use a manifest of stable work-unit IDs and their input scope. Partition by coherent responsibility, source group, or dependency boundary rather than one agent per file by default.

Run independent investigations or transformations in bounded batches. Each unit has its own ownership and result. A verification stage checks findings against current sources or artifacts. Synthesis receives verified findings, unresolved contradictions, and coverage gaps.

Track each required manifest entry through its returned result. A failed, stopped, missing, or null result is a gap. Retry only after inspecting partial artifacts and identifying a recoverable cause. Do not discard absent results and then claim complete coverage.

For candidate races, preserve the skill's declared selection rule. For source research, copied claims are not independent corroboration. Resolve disagreements with evidence rather than majority votes or averaged confidence.

## Dependent phases

Run prerequisites before their consumers. Define the artifact and revision each phase accepts. Preserve required independent contexts for candidate creation, critique, judging, and implementation review.

Use one owner for a shared schema or interface. Dependent workers consume the accepted revision. Parallelize only independent consumers. One integration owner accepts outputs and checks the combined artifact.

For candidate/critique/selection, each candidate explores its assigned approach without restarting the enclosing comparison. Give the judge the original requirements, candidate artifacts, and the domain rubric. Candidate selection stops when the choice would override a design the user chose.

For migrations, prove a pilot before expanding to dependent waves. Run per-unit checks and combined integration checks. Do not call isolated passing patches an integrated result.

## Bounded work/check/repair

Run the real checker, inspect failures, repair the authorized defect, and check again. Define success, failed verification, missing prerequisites, no progress, and maximum rounds before starting.

Independent review remains a separate fresh stage when required. A failed check is evidence for a targeted repair of its cause, including a cause outside the original diff that blocks the goal. It does not justify unrelated changes. Domain limits such as one authored issue-fix attempt remain binding even when a general pattern supports retries.

Stop when the condition is met, evidence cannot resolve the next step, ownership would change, or the budget is exhausted. Preserve partial work and report its actual state. Timed wakes are not needed merely because this computation repeats.

## Worker contract

Give each worker:

- Its unit/stage ID, role, requested outcome, and assigned scope.
- The original requirements relevant to that stage and absolute paths to needed domain guidance.
- The accepted input artifact, expected base revision, and applicable source access.
- Exclusive writable resources or an explicit read-only assignment.
- Real verification commands, acceptance conditions, budget/deadline, and stopping conditions.
- The result shape needed by the next stage.

Workers execute this stage only. Enclosing routing is already satisfied. They do not rerun global procedure selection or create another scheduler. Return missing prerequisites and proposed scope changes to the coordinator. Writers share the codebase, preserve others' edits, and accommodate outputs outside their ownership.

Use compact structured results when the next stage branches on them. Include unit/stage ID, status, artifact/evidence paths, actual base/result revision when relevant, check commands and outcomes, findings with severity/confidence, partial changes, actions taken (installs, pushes, sign-ins, external operations) with their targets, and blockers. Use PASS, ISSUES, BLOCKED, or INCONCLUSIVE as appropriate: PASS means the acceptance condition is met (non-blocking observations that are not defects may accompany it), ISSUES means proven defects remain, BLOCKED means a prerequisite, access, or capability was missing, and INCONCLUSIVE means the evidence could not decide. When a proven defect exists, report ISSUES and list any missing prerequisites as blockers; use BLOCKED only when no defect is proven. Domain skills use this same set for worker stage results unless they define their own outcome set for a specific deliverable (for example maintain-verification-skill's outcomes or authenticated-browser's worker report); map such outcomes onto these four when a later stage branches on them. Output-schema validation does not establish factual correctness.

Reviewers receive the original request, actual artifact/diff, and relevant evidence rather than the implementer's conversation or reasoning. Ordinary fresh agents start without conversation history. Do not use a conversation fork for independent review. Shared standing instructions do not substitute for supplying the concrete task facts.

The main coordinator accepts results, resolves findings, integrates changes, and writes the user answer. A worker does not need main-session Task tools to begin or finish its stage.

## Native Workflow

Load the installed workflow-authoring skill before writing or editing native JavaScript so the current runtime API is in context. Use the available native Workflow tool. Do not launch an ordinary Bun script and describe it as a native workflow.

Native scripts coordinate agent(), pipeline(), parallel(), phase(), and their structured results. Other runtime facilities, including budget and nested workflow(), must follow the installed authoring reference. Keep orchestration small and task-specific. Use a schema when later phases need machine-readable worker output.

Native agent options differ from ordinary Agent arguments. Use the installed API's agentType, label, phase, schema, and worktree isolation where appropriate. Do not copy subagent_type or run_in_background into native JavaScript. Omit per-run model and effort overrides. The bundled agent definitions inherit the session policy; other definitions and environment overrides can select different defaults. Keep the configured effort cap.

Agents start fresh. Supply their task facts and absolute resource paths; they do not inherit the main conversation's file reads or invoked skills. The native script itself has no direct filesystem, shell, or module-loading access. An agent runs Bun helpers or other project commands. Do not import the bundled helpers into the workflow sandbox.

Ordinary child agents do not launch Workflow themselves. Keep graph coordination in the main coordinator's script. The authoring reference supports bounded script-level nesting; use it only for a concrete composed procedure, not an extra coordinator layer.

Use runtime-generated script files for one-off runs. Saved personal scripts belong under the active profile's workflows/ only when reusable workflow/profile maintenance is requested. Every native script, saved or one-off, starts with a literal export const meta object containing name and description (and phases when used). Saving a recurring procedure is a separate choice from executing this task.

If Workflow is unavailable, report the capability limit and choose an available execution method that still satisfies the domain obligations. Do not invent a tool or silently omit required coverage and review.

## Ordinary delegation

Use the native Agent tool for a few bounded specialists. Implementation stages use the engineer definition; comment-only stages use comment-reviewer; local commit preparation uses commit-agent, after writers in that working tree finish; version-specific package, SDK, CLI, or API questions use source-docs-researcher. Read-only investigators or fresh independent reviewers can use general-purpose with a narrow role and applicable tool restrictions.

Use the ordinary Agent schema exposed in the current session. Inputs typically include description, prompt, subagent_type, and worktree isolation; use only the fields the current schema actually lists. Use run_in_background only when fork mode is off and the tool exposes it. Omit per-run model overrides; the bundled definitions inherit the session, while other definitions or environment overrides can select a different default. Do not invent readonly, environment, cloud_base_branch, or resume arguments. Shell and MCP access can mutate state; prompt scope and actual tool restrictions both matter.

Results return to the spawning parent. Collect the actual terminal results and supervise expected completion/output. Resume an existing worker through the available native mechanism such as SendMessage with its real ID; messaging is not a liveness probe. Do not require an invented main recipient, mailbox file, or orch inbox.

Native Agent nesting normally permits three layers below the main conversation, but availability does not authorize an assigned worker to expand its scope. The coordinator owns extra stages and ownership changes.

## Resource ownership

Assign shared schemas, lockfiles, branches, worktrees, browser tabs/login sessions, ports, CI controls, and external records as well as files. Use one owner for live UI reproduction and serialized measurement. Other workers can inspect sources independently.

Worktree isolation does not guarantee the desired base. Native worktrees can default to the remote default branch, and agent options do not select a base SHA. Give the writer the accepted revision and require it to establish and verify that revision in its actual worktree before editing. Alternatively, assign an explicitly prepared worktree without automatic isolation, or use disjoint ownership where appropriate. Preparing the parent checkout alone does not establish the child base. Uncommitted parent changes are not automatically present in a new worktree; supply an accepted artifact and explicit transfer instructions when those changes are required. Return BLOCKED if the required input cannot be established safely.

Do not assume independent file edits are independent behavior. Verify shared interfaces and integrate through one owner. A failing worker may leave useful changes or completed side effects; inspect files and receipts before retrying. Preserve other owners' changes.

Issue workflows require their actual configured harness, adapters, tool access, and action authorization. A native graph does not install services, connect accounts, create event triggers, or make a shared browser session parallel-safe.

## Supervision and time

Set observable completion/output checks and finite deadlines. Native workflow progress helps supervise agents; domain success still depends on actual evidence. Use available run/agent stop controls for a stalled run rather than silently detaching it.

Use Monitor for a native output stream when available, or a bounded process wait that checks exit status and expected artifacts. Monitor is unavailable under some providers/telemetry settings. Its documented deadlines are up to thirty minutes. In one-shot print mode, the wait for running background work before exit defaults to ten minutes; this profile's settings.json raises that ceiling to sixty minutes through CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS. Stop finished monitors with TaskStop.

A watcher, Cron task, or scheduled wake serves an external-state wait or authorized recurrence. It supplements the selected executor. Inspect existing scheduled tasks before adding another. A status question does not authorize ongoing polling, CI reruns, repair, publication, or landing.

Use native goal tracking only for an explicitly requested sustained outcome. Self-paced loops, background Bash, and monitors are not restored on resume. Eligible fixed Cron tasks can be restored; expired recurring or past one-shot tasks are not. Confirm actual restored state rather than duplicating the schedule.

## Evidence, project facts, and resume

Native Workflow can replay completed calls and resume interrupted work within the same Claude session. A fresh session is not the same replay context. Failed, interrupted, or changed calls can rerun and invalidate later work. Inspect the actual run state before choosing resume versus a new bounded run.

Reconcile the current revision, sources, partial changes, and external-operation receipts. Revalidate evidence affected by changes. Cached output is not current proof. Do not replay a non-idempotent external action just because its agent failed to return a report.

Use a project/run-scoped evidence ledger when work spans runs. One coordinator accepts worker evidence into it. Bind code verdicts to the exact PR and head SHA; bind source claims to provenance and relevant source/retrieval dates. Keep unresolved gaps and decisions visible.

The orch helper maintains coarse cross-run work-unit metadata, exact-head verdicts, stack frontier, decision gates, standing orders, and rendered project status. It does not dispatch agents or maintain a completion inbox. Unit state describes project progress, not individual agent lifecycle. Native run state is the authority for active/completed nodes and retries.

The orch ledger records the evidence level behind an accepted verdict rather than the PASS/ISSUES/BLOCKED/INCONCLUSIVE status itself. Record a PASS as `live-ui-verified`, `unit-test-verified`, or `type-check-only`, according to the strongest evidence that supports it. Record ISSUES as `verifier-failed`, and record BLOCKED or INCONCLUSIVE as `verifier-blocked`.

Run helpers by resolved absolute paths, for example bun "<profile>/tools/workflow/orch/orch.ts" --store "<project>/.claude/run-state/<run>" status. Other helpers provide plan checks, decision logging, worktree inventory, and current PR readiness. Current Git/GitHub observations remain necessary even when a prior ledger receipt exists.

## Validate routing changes

Evaluate ordinary task prompts in fresh Claude sessions using the active profile and actual tool traces. Preserve realistic artifacts and independently check outcomes. Do not tell the candidate the intended tool choice or ask it to recite applied skills.

Cover a narrow fix, a simple explanation, a deterministic bulk rename, a partitioned audit with finding verification, dependent schema/caller edits, cross-source contradictions, real UI reproduction, missing issue configuration, a long external wait, failed workers, and resumed work with stale evidence. Include a prompt whose discovered partition changes after work starts.

Check justified executor selection, skill discovery, coverage, independent review, ownership, stopping conditions, and actual results. A failed worker cannot produce complete coverage, and an unavailable adapter cannot become a working automation. Record model/version and settings for reproducibility.

Static frontmatter/path validation and helper tests prove their own boundaries. They do not prove model routing. If authentication or live-model access is unavailable, report the skipped fresh-session checks explicitly.
