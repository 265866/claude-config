---
name: arena
description: "Compare independently produced artifacts against a rubric, then synthesize and verify one coherent result. Use when a consequential unresolved choice has materially different viable approaches, or the user requests competing attempts. Use swarm for evidence coverage without artifact synthesis. Also use for /arena, 'arena this', or 'throw it in the arena'."
---

# Arena

Produce independent attempts at the same task. Read every candidate end to end. Pick the strongest as the base. Adapt useful ideas from the others into it. Verify the synthesized result.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). This skill owns the comparison, blinding, and synthesis requirements. Candidate and judge workers perform their assigned stages without restarting routing, launching another arena, or implementing beyond their scope.

## Start

1. Frame
2. Fan out
3. Cross-judge
4. Pick
5. Graft
6. Verify

## Phase A: Frame

The N candidates will receive the same prompt, plus at most a named design direction when the frame assigns one, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric. State what success looks like for *this* task, then turn it into 3-6 concrete gradeable criteria. The rubric is the picker's tool in Phase D. Candidates only see the task.
3. Pick independent runners that inherit the profile model. Default to three candidates; add more only when the task has more than three substantive design directions. Same-model independent attempts are the supported default. Do not claim model diversity.
4. Assign isolated outputs under the execution guide's ownership rules. Use the **principle-separate-before-serializing-shared-state** skill. If the design is settled or the task is mechanical, skip the candidate comparison and use the applicable narrower procedure, unless the user explicitly asked for competing attempts; then say why the comparison looks unnecessary and run it. Match each candidate's workspace to its artifact and to what the request authorizes; an invoking skill's own workspace rule, such as architect's runner prompt, takes precedence. Implementation candidates need a request that authorizes implementation and a git repository: give each its own git worktree. Without worktrees, compare sketches or reports instead, tell the user the comparison ran on sketches and why, and implement the chosen design afterward through the matching playbook. Sketch or report candidates work in their own subdirectories of a directory in the OS temporary directory. Keep the run's records (each candidate's rationale, any snapshot of the base candidate, the synthesis note, and verification output) in a run directory in the OS temporary directory that no candidate is given. Without implementation authorization, the user's repository stays unchanged, except for prose the user asked for there (see Outputs).

## Phase B: Fan out

Execute the candidates with the selected executor. Give each the task, its named direction if the frame assigns one, shared grounding, resolved supporting paths, its own workspace, and instructions to produce the artifact in the workspace and return a short rationale in its result (under Refactoring, an implementation candidate also returns what its subtraction removed, as Outputs describe; architect sketch candidates do not implement). When a candidate finishes, store its rationale under its neutral label in the run directory, or where the invoking playbook keeps its records. Keep the rubric private from candidates. Resolve each candidate's completion before judgment; candidates that still fail after the retry rule below remain explicit gaps.

Each rationale names the alternatives the candidate considered and what it rejected.

If a candidate fails to produce output, retry it only after you inspect its partial artifacts and find a recoverable cause, per the [execution guide](${CLAUDE_SKILL_DIR}/../../references/execution.md). Respawn it at most once, as a fresh candidate with the same prompt and named direction, if any, plus every later directive sent to all candidates or to the failed candidate, in a fresh workspace, without the failed candidate's partial artifacts or report, and note any dropout in the synthesis record. Directives given only to you stay out of the retry, so every candidate works from the same task. Do not claim the planned comparison was completed when a required design direction is missing.

## Phase C: Cross-judge

After Phase B outputs are final, assign one fresh-context judge a read-only review. It sees the rubric and candidates by neutral path label, scores every criterion, and recommends a base with rationale. It may run alongside the coordinator reading in Phase D. Do not judge candidates while they are still writing, or supply another reviewer's verdict as the judge's starting conclusion.

## Phase D: Pick a base

Read every candidate end to end before picking.

Score each candidate against the rubric criterion by criterion, not on holistic feel. Compare against the cross-judge. Agreement on the base confirms the pick. Investigate disagreement for bias or an ambiguous rubric. Read both rationales before deciding.

Pick the base with the strongest rubric scores. Between candidates the rubric leaves close, prefer the one a future maintainer can extend most easily without breaking invariants, then the cleaner boundary or smaller API, per the Laziness Protocol.

Record the pick and the reason in a short synthesis note in the run directory, including the cross-judge's verdict.

## Phase E: Graft

Walk each losing candidate once more and identify what is worth porting into the base. The signal is usually one or two things per candidate, not most of it.

When the user asked for competing attempts, first save the base candidate's original artifact in the run directory (for a worktree, run `git add --intent-to-add .` there, then save `git diff --binary <accepted revision>`) so it can still be linked, and say when it includes a shared pre-written test. Fold each graft in by hand, per the **principle-redesign-from-first-principles** principle skill. Don't paste mechanically. The result has to remain coherent under one mental model.

Record what was grafted, from which candidate, and what was rejected and why.

When N candidates converge on the same shape, that is a strong agreement signal. Note the convergence in the record and deliver the consensus shape. No graft is needed. Divergent design approaches are the expected input to Phases D and E: pick a base and graft, never average them. Reframe Phase A and rerun only when candidates solved different problems or misread the brief, which means Phase A was under-specified.

## Phase F: Verify

The synthesized artifact has to hold up under the same scrutiny as any other output, per the **principle-prove-it-works** principle skill.

If verification surfaces a problem the arena did not catch, check whether Phase A was wrong or a candidate caught the issue and you missed the graft. Reframe and rerun when the brief was wrong; return to Phase E when a useful candidate finding was missed. Investigate other causes when the evidence points elsewhere. Do not hide the failure.

## Outputs

One synthesized artifact, and one short synthesis note in the run directory naming the base, the grafts (with source candidate), the rejections, the dropouts if any, and the verification result.

- When the user asked for competing attempts, link each candidate's artifact and rationale, and keep everything the reply links.
- Without implementation authorization, everything stays in the OS temporary directory and nothing is committed, except prose the user asked for in the repository, which the invoking skill, or the coordinator when arena runs directly, writes there after synthesis, uncommitted unless the user also asked for a commit.
- When the invoking skill decides where the artifact goes, follow it; architect keeps an unfinished design package uncommitted, in the base worktree when candidates worked in worktrees and otherwise in its OS-temporary design directory, until its Phase D has implemented all of it.
- Otherwise, the playbook that encloses the run, or when arena runs directly the playbook that matches the change, still governs. After a sketch-only comparison without worktrees, that playbook's implementation step builds the synthesized sketch. When candidates worked in worktrees (including architect sketches its Phase D implements in the base worktree), arena stands in for that playbook's implementation step only (for Refactoring, steps 4 and 5):
  - Its earlier steps (such as Bug fix's reproduction) come first, except a design step whose choice this arena resolves.
  - For architect sketches, right after Phase E and before the pre-written test or architect's Phase D, handle each prose file the design package added (rationale, module map, usage notes) and each prose-only edit it made to tracked files (such as usage notes in an existing README) that the user did not ask for in the repository: move the file to the run directory and run `git reset -- <path>` in the base worktree, or save the edit with `git diff --binary -- <path>` in the run directory and revert it, keeping the sketch code. Give architect's Phase D implementer its own copies outside the run directory and the base worktree, and deliver them with the reply. Leave prose the user asked for in place; the commit-agent brief names it for the implementation commit (under Refactoring, the reshape commit).
  - A test the playbook writes before implementation (Bug fix step 5's **tdd** regression test, confirmed failing; Refactoring step 1's pin, confirmed passing) reaches every implementer as a patch of only the test paths, made against the accepted revision with `git add --intent-to-add -- <test paths>` and `git diff --binary HEAD -- <test paths>`, holding none of the user's own uncommitted edits. Make and confirm it in a scratch worktree detached at the accepted revision (`git worktree add --detach <path> <accepted revision>`). Take it from the user's working tree only when its `HEAD` is the accepted revision and the test paths there hold nothing but the earlier step's edits; then reverse that copy out with `git apply -R` and `git reset -- <test paths>`. Otherwise leave the user's copy alone, and before integration ask how to reconcile it. These scratch worktrees, and the check worktrees below, are detached at the accepted revision or at commits the base branch keeps, and hold only patches the run saved elsewhere, so worktree-cleanup's merged-branch condition does not apply to them: return each to clean with `git reset -q --hard` and `git clean -fd`, then remove it with `git worktree remove` (never `--force`) once `git status --ignored` shows only regenerable ignored files, or keep and list it when it does not or removal fails. Give each implementer, including a retry and architect's Phase D implementer, its own copy outside the run directory and every candidate worktree to apply uncommitted before it starts; for architect sketches, apply it only to the base worktree before architect's Phase D.
  - Implementers, and the coordinator while grafting, may adapt only how the test reaches renamed, moved, or reshaped code (imports, names, call shapes), never its inputs, expected values, or assertions, and record each change. Before review, confirm every difference from the saved patch is a recorded call-site adaptation, and give the reviewer the patch and the recorded changes.
  - The playbook's review and verification run on the synthesized base worktree once it holds the implementation (after Phase E, or after architect's Phase D), including any review it requires before a commit (such as Opening a PR step 2). Then commit with the **commit-agent** agent. A failing test, adapted or not, lands in the same commit as its fix. A passing pin, adapted or not, lands in the first commit against which it passes as written (every name and call shape it uses exists there); earlier commits are checked with the saved pin patch. Under Refactoring, each implementer (each implementation candidate in its result, or architect's Phase D implementer in its report) records what its subtraction removed (paths and symbols), and the coordinator adds any subtraction it grafts. The brief gives the commit-agent that list, which commit each pre-written test lands in, and step 8's order (the subtraction, then the reshape); outside Refactoring, the brief still says where each pre-written test lands. When the commit-agent reports that the subtraction cannot be separated without editing content, brief a fresh commit-agent for one commit holding both, and say why in the reply. Under Refactoring, the coordinator also checks each resulting commit in a detached scratch worktree with the project's configured build and type check, when configured, and against the pin, applying the saved pin patch where a commit lacks the pin; it folds a commit that cannot pass into the next one, reporting why, and returns each check worktree to clean and removes it, or keeps and lists it, as the pre-written test bullet above describes.
  - Integrate the base branch as that playbook delivers: merged into the branch checked out in the user's working tree for local delivery, with verification repeated on the merged result, or pushed as the PR head when a PR is requested. Under Autopilot or Orchestrate, the base branch is the change's or unit's own branch: record its head as that playbook says, leave integration to its integrator rather than merging it into the user's checkout, and keep its worktree for fix rounds. When the playbook's review needs a show-me-your-work trail, the coordinator starts it before Phase B, or continues an existing trail, adding a `start` row when show-me-your-work's run rule calls for one, audits its own rows before that review, and, when another agent continues the change, gives it the path to continue with a `start` row.
- At the end of every run, list each candidate worktree, branch, and temporary workspace the run created that still exists, with its state and the exact removal command. Remove without asking only worktrees that [worktree cleanup](${CLAUDE_SKILL_DIR}/../../playbooks/worktree-cleanup.md) lets you remove without asking; ask before removing the rest, and keep anything the reply links or the invoking skill still uses. An invoking skill that keeps the base workspace lists it when it finishes with it.
