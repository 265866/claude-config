---
name: architect
description: "Ground consequential design choices, sketch caller usage, types and module boundaries, and verify implementation against the chosen design. Use for architecture requests or unresolved ownership, API, state, or layering decisions. Skip candidate comparisons for settled designs and mechanical edits. Also use for 'architect this' or 'design this'."
---

# Architect

Design before implementing when the task contains an unresolved consequential design choice. Sketch caller usage, types, signatures, and boundaries at the depth needed to resolve that choice. Fill in code against the chosen sketch. If implementation disproves the sketch, redesign it.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). This skill defines the design stages. An assigned candidate owns one design only and follows `references/runner-prompt.md`; it does not rerun the enclosing procedure.

## Start

1. Ground
2. Sketch
3. Agree
4. Implement
5. Scrap

## Phase A: Ground the problem

Build a real mental model of every system the new code touches. Run the **how** skill over the relevant subsystems.

Naming a file isn't grounding. Produce the traced model `how` prescribes. If the design redefines ownership or layering, also run the **why** skill on the existing shape so the rationale becomes a constraint, not a guess.

Skip Phase A only when the work is genuinely greenfield with no surrounding system to integrate.

## Phase B: Sketch

For an unresolved consequential choice with materially different viable approaches, use the **arena** comparison contract with the Phase A grounding. Resolve `references/runner-prompt.md` and `references/rationale-template.md` for candidate assignments. Each candidate produces a package shaped by that template. Make interface depth and the one-file-change test below criteria in the arena rubric, so arena's rubric-first pick applies them.

Compare at least two structurally distinct viable approaches when that choice warrants independent exploration. Whole-shape alternatives matter more than point fixes inside one shape. When existing conventions or an already approved design settle the shape, produce one proportionate sketch and proceed within that scope; do not force a second candidate unless the user explicitly asked for competing designs, in which case say why comparison looks unnecessary and run it.

Screen every candidate against [`references/design-red-flags.md`](references/design-red-flags.md) before synthesis. Reject or revise a candidate that shows any red flag. For a design the user chose, report the red flag instead of overriding the design. Assume the next contributor is an agent that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles. Prefer the design where a change that looks right from one file is right for the whole repo.

Compare viable candidates on interface depth. Prefer the design that hides more complexity behind a smaller, simpler public surface. A rich interface can keep call chains short by concentrating capability instead of scattering it across layers.

The comparison returns one synthesized design package. Record the choice in the rationale's "Synthesis decision" section. For a settled design, record why comparison was unnecessary; when the user requested a comparison anyway, also record that request and the comparison's base, grafts, and rejections.

## Phase C: Agree (opt-in)

Proceed to implementation when the user already authorized that design scope. Choose among the alternatives yourself, including a materially different architecture (as CLAUDE.md defines it), and record why. Report a materially different choice and its reason prominently. Overriding a design the user chose is a product decision for the user. A design-only request changes the repository only as Outputs says for prose the user asked for there.

Opt in to a checkpoint when the invoker explicitly asks: "/architect with checkpoint," "stop and show me before implementing," or similar. Then surface the synthesized design and pause for sign-off.

Keep the synthesized sketch uncommitted: in arena's base worktree when an arena comparison ran in worktrees, otherwise in the design directory in the OS temporary directory that Outputs names, with its prose. Phase D implements it where the governing playbook implements (in that base worktree when arena ran in worktrees), bringing each sketch file into that tree as it implements it, so the governing playbook's checks (such as Refactoring's pin) keep passing. Phase D commit rule, which also governs a pause checkpoint: commit nothing from the sketch until Phase D has implemented all of it, leaving no `not implemented` body or `// TODO` pseudocode; commits then follow the governing playbook. Keep the usable product in place until the replacement reaches a verified working state. For adversarial pressure on the design before implementing, run the **interrogate** skill on the synthesized sketch.

If the human pushes back on the shape (in a checkpoint or after the fact), treat that as Phase A evidence. Re-ground and re-run Phase B before writing more code.

## Phase D: Implement against the sketch

Replace `not implemented` bodies with code, pseudocode with logic. The synthesized sketch is the contract. When the sketch lives in an arena base worktree, implement there, then integrate and list workspaces as arena's "Otherwise" and "At the end of every run" Outputs bullets describe.

Deviations from the sketch are signal worth surfacing, not friction to absorb silently. If a function needs a parameter the sketch didn't anticipate, ask whether the sketch was wrong, the requirement was missed, or the implementation is overreaching.

## Phase E: Scrap when the architecture is wrong

If implementation keeps producing friction the sketch can't absorb, throw the sketch out. Don't bolt fixes onto a wrong design, per the **principle-redesign-from-first-principles** and **principle-fix-root-causes** principle skills.

The signal is a *pattern*, not single instances. Tells:

- The same shape of workaround appearing repeatedly across unrelated code.
- Multiple unrelated edge cases that all need special-case branches.
- Types that need escape hatches (`any`, casts, optional fields always set in practice) to compile.
- The "we need a lock" reflex when the sketch said the state wasn't shared.
- Callers having to know the abstraction's internal rules to use it.
- Two or more independent Phase D deviations of the same shape across the implementation.

Use judgment. A few edge cases don't condemn an architecture. Some problems are legitimately complex. Complexity in the data is not complexity in the design.

When you scrap:

1. Re-run the **how** skill over what's been built.
2. Redesign as if the new constraints had been day-one assumptions, per redesign-from-first-principles.
3. Subtract before adding, per the **principle-subtract-before-you-add** principle skill. The new sketch should be smaller than the old one before it grows.
4. Return to Phase B and reassess the unresolved choice. Repeat comparison only when new evidence warrants it.

## Outputs

The caller's usage is written first and the type sketch derived from it. One file with new types and signatures for small changes. Module map plus type definitions for larger work. The rationale accompanies it, shaped per `references/rationale-template.md`, including the usage sketch and the synthesis decision. The prose files (rationale, module map, usage notes) are delivered with the reply and kept out of every commit unless the user asked for them in the repository. Without an arena that ran in worktrees, write the sketch and each prose file the user did not ask for in the repository in a design directory in the OS temporary directory; with arena, its Outputs move it out of the base worktree. Prose the user asked for in the repository lands in the implementation commit (under Refactoring, the reshape commit); without implementation, write it uncommitted at the requested path after synthesis, unless the user also asked for a commit.
