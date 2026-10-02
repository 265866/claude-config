---
name: arena
description: "Compare independently produced artifacts against a rubric, then synthesize and verify one coherent result. Use when a consequential unresolved choice has materially different viable approaches, or the user requests competing attempts. Use swarm for evidence coverage without artifact synthesis."
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

The N candidates will receive the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric. State what success looks like for *this* task, then turn it into 3-6 concrete gradeable criteria. The rubric is the picker's tool in Phase D. Candidates only see the task.
3. Pick independent runners that inherit the profile model. Choose enough candidates to cover the substantive design directions; same-model independent attempts are the supported default. Do not claim model diversity.
4. Assign isolated outputs under the execution guide's ownership rules. Use the **principle-separate-before-serializing-shared-state** skill. If the design is settled or the task is mechanical, skip the candidate comparison and use the applicable narrower procedure.

## Phase B: Fan out

Execute the candidates with the selected executor. Give each the task, shared grounding, resolved supporting paths, its own output location, and instructions to return both the artifact and a short rationale. Keep the rubric private from candidates. Resolve each candidate's completion before judgment; failed or silent candidates remain explicit gaps.

Each rationale names the alternatives the candidate considered and what it rejected.

If a candidate fails to produce output, use bounded recovery and note the dropout in the synthesis record. Do not claim the planned comparison was completed when a required design direction is missing.

## Phase C: Cross-judge

After Phase B outputs are final, assign one fresh-context judge a read-only review. It sees the rubric and candidates by neutral path label, scores every criterion, and recommends a base with rationale. It may run alongside the coordinator reading in Phase D. Do not judge candidates while they are still writing, or supply another reviewer's verdict as the judge's starting conclusion.

## Phase D: Pick a base

Read every candidate end to end before picking.

Score each candidate against the rubric criterion by criterion, not on holistic feel. Compare against the cross-judge. Agreement on the base confirms the pick. Investigate disagreement for bias or an ambiguous rubric. Read both rationales before deciding.

Pick the base on which candidate a future maintainer can extend most easily without breaking invariants. Prefer the cleaner boundary or smaller API when two feel tied, per the Laziness Protocol.

Record the pick and the reason in a short synthesis note alongside the base artifact, including the cross-judge's verdict.

## Phase E: Graft

Walk each losing candidate once more and identify what is worth porting into the base. The signal is usually one or two things per candidate, not most of it.

Fold each graft in by hand, per the **principle-redesign-from-first-principles** principle skill. Don't paste mechanically. The result has to remain coherent under one mental model.

Record what was grafted, from which candidate, and what was rejected and why.

When N candidates converge on the same shape, that is a strong agreement signal. Note the convergence in the record and ship the consensus shape. No graft is needed. Divergent design approaches are the expected input to Phases D and E: pick a base and graft, never average them. Reframe Phase A and rerun only when candidates solved different problems or misread the brief, which means Phase A was under-specified.

## Phase F: Verify

The synthesized artifact has to hold up under the same scrutiny as any other output, per the **principle-prove-it-works** principle skill.

If verification surfaces a problem the arena did not catch, check whether Phase A was wrong or a candidate caught the issue and you missed the graft. Reframe and rerun when the brief was wrong; return to Phase E when a useful candidate finding was missed. Investigate other causes when the evidence points elsewhere. Do not hide the failure.

## Outputs

One synthesized artifact. One short synthesis note alongside, naming the base, the grafts (with source candidate), the rejections, the dropouts if any, and the verification result.
