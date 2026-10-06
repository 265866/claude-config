### Multi-phase or multi-PR plan

Own the plan, not implementation. The deliverable is a checklist with named owners, dependencies, observable checks, and a completion predicate.

1. Skip a separate plan for an obvious one- or two-file change unless requested. For larger work, investigate the real entrypoints, types, ownership boundaries, and configured checks with the how skill.
2. Settle observable uncertainty with read-only investigation. When only a prototype could settle it, record the prototype as an open decision unless the user authorized one. Ask only when a choice would override a design the user chose or is another genuine product/preference decision. Record evidence and unresolved assumptions.
3. Choose exploration through [the execution reference](../references/execution.md). Use native independent batches when partitioning, result reconciliation, and coverage warrant it; direct tools or a few delegates suffice for smaller questions. Every brief names its read-only scope, question, acceptance criteria, and file-pointer report. Inherit the configured model and effort. Keep overlapping implementation scopes out of the same worktree.
4. Write the plan at the user-specified path, or `<project>/.claude/plans/<slug>.md`. Use the schema below. Scale phases and verification lanes to the actual change. A documentation-only phase does not need a UI or performance lane.
5. Read the technical-writing and edit-prose skills. Give each phase a check that demonstrates behavior or proves its stated invariant. Record the execution playbook: autonomous-run for one bounded task, orchestrate for a standing program, autopilot-stack for an operator-landed stack, or autopilot-full for an explicitly authorized independently merged queue. The plan holds acceptance, dependencies, and design; Tasks displays coarse milestones; the selected runtime owns active workers and results. A user decision or an ask-first action ends the current run before the next stage. One-off generated workflows belong to task run artifacts; save a reusable personal workflow only after proven repetition and an authorized profile-maintenance request.
6. Resolve the profile root and run `bun "<profile>/tools/workflow/check-plan.ts" "<plan.md>"`. Fix every reported schema or dependency error. The validator checks the contract; it does not prove an architectural decision.
7. Deliver the plan, evidence, open decisions, and validation result. A planning request is not authorization to implement, publish, merge, or deploy.

```markdown
# <Program> plan

## Goal

<What changes, for whom, and the observable result.>

## Phases

| Phase | Owner | Depends on | Check | Status |
| --- | --- | --- | --- | --- |
| investigate | investigator | none | Evidence identifies the relevant boundary and existing checks | pending |
| implement | implementation owner | investigate | Behavior check, edge case, and regression check pass | pending |
| review | independent reviewer | implement | Findings resolved and affected checks rerun | pending |

Use unique phase IDs. Dependencies name earlier phase IDs or `none`. Status is `pending`, `running`, `blocked`, or `done`. Each owner has an exclusive file or worktree scope.

## Verification

<Exact configured test/build/lint/format commands, behavior assertions, and evidence locations. For UI changes include a real surface scenario and screenshots when visual correctness matters. Measure performance when the requirement or risk warrants it; record comparable before/after scenarios and the failure threshold.>

## Decisions

<Evidence-backed choices, alternatives rejected, assumptions, approval gates, and remaining risks. Name the execution playbook and who is authorized to publish or land any PRs.>

## Completion

<The checkable done condition, phase evidence, deliverable paths, and unresolved blockers. Never treat missing authorization or unavailable verification as a pass.>
```

For a PR stack, add each PR's base, head SHA, owner, expected diff, and verification receipts under the appropriate phase. Inherit native worktree isolation from the execution workflow; explicitly prepare a worktree when its base must be a specific parent SHA. Read installed playbooks from this profile, not from the target repository's trunk.

**Reply.** Plan path, phase dependencies, what evidence established, what remains undecided, and the validator result. Stop after delivering a requested plan.
