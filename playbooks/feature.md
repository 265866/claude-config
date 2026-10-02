### Feature

**You own the design. Plan, review, verify.** Choose execution using [the execution reference](../references/execution.md).

1. `how` over the affected subsystem.
2. Use `architect` when the change needs a material design choice. Follow settled conventions for a small or mechanical change; crossing a function boundary alone does not require competing designs. Stop before implementation when the choice needs the user's decision.
3. Record dependencies and shared-resource ownership in the plan, scaled to the work:
   - **Blocking first steps.** Gates run before fan-out.
   - **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
   - **Shared mutable state.** Split independent targets where useful (the **principle-separate-before-serializing-shared-state** skill). Give shared branches, lockfiles, integrations, and live UI sessions one owner.
4. Implement through the selected execution method. Give delegated units exact file ownership and success criteria, inheriting the configured model and effort. Name the data shape and organizing structure before writing logic, per **principle-model-the-domain**. Prefer a state machine over scattered booleans, a table/registry over branching, and a typed model over repeated shape assumptions.

   Use **arena** when independent alternatives can resolve a consequential uncertainty, rather than for every stylistic choice. Non-trivial implementation gets fresh-context review regardless of how it was executed. Workers own their assigned unit; the coordinator arranges other phases and independent review.

   Follow the comment rules in CLAUDE.md (Verification and communication) for every file you produce, including delegated diffs. Keep edits narrow and re-ground upstream-derived files against source. Apply shared-primitive improvements to every consumer and verify each. Commit in small verified units.
5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass. Flag it.
6. Deliver small, ordered commits. Stack follow-ups. Prepare new commits from working-tree changes with the **commit-agent** agent. Rewrite existing commits (rebase, squash, reorder) only when the user asked for history editing.
   Use the **principle-sequence-verifiable-units** skill: verify prerequisites before dependent work, allow independent units to run in parallel, check each unit before acceptance, and verify the combined artifact before calling it integrated. Deliver passing commits in dependency order.
7. If the design is contested, `interrogate` before shipping.
8. Run **Opening a PR** only when creation is explicitly requested or approved. Otherwise deliver the verified local result.

Keep coupled edits under one owner until dependencies are settled. Use native dependent phases or independent batches when their coordination warrants it; direct tools or small delegation are sufficient otherwise. The coordinator owns the execution plan, and workers do not restart routing. Update the plan when evidence changes a dependency, and obtain approval before material delegation-boundary changes. Tasks displays coarse milestones rather than duplicating the worker graph.

**Reply:** what you built, what you chose and why, relevant dependencies and ownership, remaining limitations with their blockers, and only the decisions that need the user (approval gates or product choices). Tables for design alternatives.
