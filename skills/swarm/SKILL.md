---
name: swarm
description: "Coordinate independently scoped workers and return a report accounting for every required result. Use for partitioned audits, complementary investigations, review gauntlets, or an explicitly requested candidate race. Use arena when the goal is to synthesize competing artifacts."
---

# Swarm

Cover independent slices, compare attempts at the same brief, or mix both. The coordinator accounts for every required result and returns one report.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). This skill owns coverage and selection contracts, not scheduling. A delegated worker completes its assigned slice and returns evidence or a blocker; it does not restart routing or launch another swarm.

## Start

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the meaningful slices or approaches. N is total workers, not the available local concurrency. A narrow investigation can stay direct; do not manufacture slices to justify orchestration.
4. Workers inherit the profile model. For a candidate race, name each arm's design or investigation approach up front. Do not describe independent same-model runs as a model race.
5. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Execute the independent assignments using the selected executor. Each brief names its local starting commit and supplied artifacts. Resolve supporting paths before handing them to a worker. Keep the ownership and result checks from the execution guide; no remote branch is needed to create a worker environment.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use the execution guide's statuses, `PASS`, `ISSUES`, `BLOCKED`, or `INCONCLUSIVE`, with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, follow the bounded recovery policy and keep that required result visible as a gap. Useful partial findings may be reported, but incomplete coverage cannot pass.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and rerun that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
