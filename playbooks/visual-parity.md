### Visual parity

**You own pixel-exact equivalence. The baseline is the spec. You do not touch it.** Equivalence is verified by image diff, not by eye.

1. Establish the baseline first, before any migration: a visual regression harness that screenshots the current component across its states, plus the target when matching two implementations. No baseline, no parity claim. A blocking prerequisite, not a follow-up.
2. Anti-shortcut clauses, stated and held: no harness modifications, no baseline tampering, no component restructuring to make a diff pass. If the baseline looks wrong, stop and ask. Don't edit it.
3. Choose execution through [the execution reference](../references/execution.md). Shared primitives migrate first as a blocking phase. Independent components can use native batches in isolated worktrees with one implementation owner per component (the **principle-separate-before-serializing-shared-state** skill); smaller migrations can run directly. Keep shared writes and the live UI/control session under one owner.
4. Verify each component against its baseline via image diff on the matching surface via the control skill. A nonzero diff is a fail. Investigate the pixel delta through bounded migrate/check/repair rounds; record no-progress and failed or missing results rather than spinning or claiming parity. Parallel writers do not imply parallel use of one live UI session. Obtain fresh-context review for non-trivial implementation.
5. Run **Opening a PR** per component or safe batch only when creation is explicitly requested or approved.

**Reply:** components migrated, the diff result for each, the baseline harness location, what's left.
