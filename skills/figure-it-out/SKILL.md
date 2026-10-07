---
name: figure-it-out
description: "Design an auditable playbook when no narrower one fits: a large migration, an ambitious multi-part change, or work a human reviews after stepping away. Scales rigor to the task, runs a hypothesis loop, and logs decisions via show-me-your-work. Use for /figure-it-out, 'figure it out' when it asks for a working result (a request only to find a cause is a read-only diagnosis), a large migration, or when no narrower playbook applies."
---

# Figure it out

When the task matches no narrower playbook, design a Markdown procedure: phases, decision points, verification gates, and an audit trail. This is the engineering plan, not the execution runtime. The main coordinator chooses direct execution, ordinary delegation, or native Workflow using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md).

## Start

Consult `${CLAUDE_SKILL_DIR}/../../references/principles.md` and load the relevant leaf guidance.

## Phase A: Frame

Ground first, then commit. Don't start the run until you can state:

- The definition of done as a falsifiable predicate (the **principle-prove-it-works** principle skill).
- Scope, quantified: rough units and effort, plus the blockers grounding surfaced.
- The rigor level, biased high. One-way doors and high blast radius get more. Reversible low-stakes steps get less. Rigor is gates and artifacts, not "try harder".

Briefly state the framing, tradeoffs, and finite budget before a long run. Proceed with reversible work in scope. Choose a materially different architecture (as CLAUDE.md defines it) when the evidence favors it, and report the reason prominently. Hold the work that depends on an ask-first action or a product decision, such as overriding a design the user chose; independent work continues. Do not impose a checkpoint merely because time passes.

## Phase B: Design the procedure and select execution

Decompose into atomic, independently landable units. Sequence riskiest-unknown-first. Scaffold and verification come before features (the **principle-foundational-thinking** principle skill).

- Build the verification harness before the work, with the baseline captured from the pre-change state, so the check reads as "old value vs new value".
- For unresolved consequential design decisions, use the **architect** skill and compare viable alternatives when warranted. Skip comparison for mechanical work whose shape is already concrete, and do not repeat a comparison over a settled design, which is over-engineering (the **principle-laziness-protocol** principle skill), unless the user explicitly asked for one; then run it through **architect**.
- Decide what fans out. Parallelize only across seams, and give each writing worker its own worktree on its own branch, or disjoint file ownership, while read-only workers need neither (the **principle-separate-before-serializing-shared-state** principle skill). Don't over-fan.
- Write the designed phase list down. That list is what the human reviews.

Choose execution from the procedure's coordination burden. Substantial independent batches, dependent phases, or bounded work/check/repair cycles favor native Workflow; deterministic transformations stay helpers. Track coarse milestones in Tasks rather than copying the executor's worker state. Execute under the Phase C loop discipline and weave the Phase D log through decisions as they land. Delegated workers complete their assigned stages without rebuilding this procedure.

## Phase C: Run the loop

Each unit is an experiment. State the hypothesis, make the smallest change, measure against the predicate on the real artifact, keep it if it advanced, revert it if it didn't.
Apply the **principle-sequence-verifiable-units** principle skill: verify prerequisites before dependent work, check each unit against its acceptance condition, and verify the combined artifact. Independent units with separate ownership may run in parallel; do not postpone all checks until the end.

- Verify by inspecting the artifact, never a self-report. When something passes too easily, suspect the observation method before the system.
- Pair delegated work with a judge. If a worker games the gate, reset and harden the contract. If the gate itself is wrong, fix the gate in its own change rather than routing around it, with evidence that it measured the wrong thing; making it non-blocking or allowed to fail is weakening, not fixing.
- A verdict uses the execution guide's statuses: PASS (verified against the predicate), ISSUES (not verified, with the proven defects), BLOCKED, or INCONCLUSIVE. Only PASS is a pass. Don't hide a negative.

## Phase D: Keep the audit trail

Log the run via the **show-me-your-work** skill. figure-it-out's work is usually ambitious enough to commit the trail so the reviewer can read it in the PR. The trail plus the diff is what lets the human come back and trust the work.

## Phase E: Verify and hand back

Check the whole against the Phase A predicate on the real product, not just the harness. Encode any recurring correction as a gate, a lint rule, a check, or a script (the **principle-encode-lessons-in-structure** principle skill).

**Reply:** the playbook you designed, the rigor level and why, the decision-trail path, what's verified against the predicate, and what's still open with the concrete blocker holding each item.
