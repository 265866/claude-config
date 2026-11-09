# Engineering principles

Use this index for substantial engineering or design work. Each line gives a principle's trigger and links its file. Read only the files relevant to the current decision. A worker applies the assigned stage's principles without restarting coordinator routing.

**Core**

- [Subtract First](principles/subtract-first.md). Sizing a diff, sequencing an addition, refactor, rewrite, or migration, replacing an internal API, or tempted to add an abstraction, layer, or signal threading.
- [Foundational Thinking](principles/foundational-thinking.md). Before writing logic, when choosing core types and data structures, sequencing scaffold and feature work, or asking what concurrent actors share.
- [Redesign from First Principles](principles/redesign-from-first-principles.md). Integrating a new requirement into an existing design.
- [Attack the Premise](principles/attack-the-premise.md). Two or more fixes that share one premise have failed the same gate.
- [Minimize Reader Load](principles/minimize-reader-load.md). Reviewing or shaping code that is hard to trace.
- [Experience First](principles/experience-first.md). Product, UX, or feature-scope tradeoffs.
- [Exhaust the Design Space](principles/exhaust-the-design-space.md). A novel UI interaction or architectural decision with no precedent in the codebase.
- [Build the Lever](principles/build-the-lever.md). A repeated transformation or fragile verification that a deterministic codemod, script, or generator could do.

**Architecture**

- [Model the Domain](principles/model-the-domain.md). Writing stateful logic, or code that branches a lot or repeats a shape assumption across files.
- [Boundary Discipline](principles/boundary-discipline.md). Wiring validation, error handling, or framework adapters.
- [Type System Discipline](principles/type-system-discipline.md). Designing types, reviewing a signature, or writing code in any statically typed language.
- [Make Operations Idempotent](principles/make-operations-idempotent.md). Designing commands, lifecycle steps, or loops that run amid crashes, restarts, and retries.
- [Separate Before Serializing Shared State](principles/separate-before-serializing-shared-state.md). Concurrent actors might write the same file, branch, key, or state object.

**Verification**

- [Prove It Works](principles/prove-it-works.md). A task is complete and you are about to declare it done.
- [Fix Root Causes](principles/fix-root-causes.md). Debugging.
- [Sequence Work into Verifiable Units](principles/sequence-verifiable-units.md). Multi-step work, such as sweeps, migrations, or runs of similar edits, and stacking commits and PRs.
- [Test Behavior, Not Implementation](principles/test-behavior-not-implementation.md). Writing, changing, or keeping a test.
- [Explain the Number](principles/explain-the-number.md). Before you measure, and before you trust, report, or act on a number you measured.

**Meta**

- [Encode Lessons in Structure](principles/encode-lessons-in-structure.md). Writing the same instruction a second time, or noticing a recurring correction.

Two former principles live elsewhere now. Proceeding on reversible work without asking is CLAUDE.md's Authorization and ownership section. Keeping large output out of the coordinator's context is the [execution reference](execution.md), under Ordinary delegation and Worker contract.
