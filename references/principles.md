# Engineering principles

Use this index for substantial engineering or design work. Each line gives a principle's trigger and its rule, and links its file. Read only the files relevant to the current decision. A worker applies the assigned stage's principles without restarting coordinator routing.

**Core**

- [Subtract First](principles/subtract-first.md). Sizing a diff, sequencing an addition, refactor, rewrite, or migration, replacing an internal API, or tempted to add an abstraction, layer, or signal threading. Remove dead weight first, make the smallest change that solves the problem, and converge on the end state instead of keeping old and new paths alive.
- [Foundational Thinking](principles/foundational-thinking.md). Before writing logic, when choosing core types and data structures, sequencing scaffold and feature work, or asking what concurrent actors share. Get the data shape right before writing logic.
- [Redesign from First Principles](principles/redesign-from-first-principles.md). Integrating a new requirement into an existing design. Redesign as if it had been foundational from day one.
- [Attack the Premise](principles/attack-the-premise.md). Two or more fixes that share one premise have failed the same gate. Write the premise down and test it directly before you write another fix that assumes it.
- [Minimize Reader Load](principles/minimize-reader-load.md). Reviewing or shaping code that is hard to trace. Count layers and hidden state, collapse one-caller wrappers, and shrink mutable scope.
- [Experience First](principles/experience-first.md). Product, UX, or feature-scope tradeoffs. Choose user delight over implementation convenience.
- [Exhaust the Design Space](principles/exhaust-the-design-space.md). A novel UI interaction or architectural decision with no precedent in the codebase. Build 2-3 competing prototypes when the request authorizes implementation, or sketches in the plan otherwise, and compare before committing.
- [Build the Lever](principles/build-the-lever.md). A repeated transformation or fragile verification that a deterministic codemod, script, or generator could do. Use the smallest reusable tool that earns its maintenance cost.

**Architecture**

- [Model the Domain](principles/model-the-domain.md). Writing stateful logic, or code that branches a lot or repeats a shape assumption across files. Encode the domain in a structure (state machine, typed model, table or registry, reducer, boundary, the right collection) instead of scattered conditionals.
- [Boundary Discipline](principles/boundary-discipline.md). Wiring validation, error handling, or framework adapters. Guard at system boundaries, trust internal types, and keep business logic pure.
- [Type System Discipline](principles/type-system-discipline.md). Designing types, reviewing a signature, or writing code in any statically typed language. Make illegal states unrepresentable, brand primitives, and parse external data at boundaries.
- [Make Operations Idempotent](principles/make-operations-idempotent.md). Designing commands, lifecycle steps, or loops that run amid crashes, restarts, and retries. Derive each step from the state that exists and leave nothing the next run cannot judge as stale, so every run converges to the same end state.
- [Separate Before Serializing Shared State](principles/separate-before-serializing-shared-state.md). Concurrent actors might write the same file, branch, key, or state object. Eliminate the sharing first.

**Verification**

- [Prove It Works](principles/prove-it-works.md). A task is complete and you are about to declare it done. Verify against the real artifact, not a proxy or "it compiles".
- [Fix Root Causes](principles/fix-root-causes.md). Debugging. Trace each symptom back to the first place the system went wrong and fix it there.
- [Sequence Work into Verifiable Units](principles/sequence-verifiable-units.md). Multi-step work, such as sweeps, migrations, or runs of similar edits, and stacking commits and PRs. Verify prerequisites before dependent work and each unit before acceptance.
- [Test Behavior, Not Implementation](principles/test-behavior-not-implementation.md). Writing, changing, or keeping a test. Assert an independently specified result of a real behavior, so the test fails when that behavior breaks and passes when only the internals change.
- [Explain the Number](principles/explain-the-number.md). Before you measure, and before you trust, report, or act on a number you measured. Name the result that would change a decision before you run, and rule out that it measured something other than the work you think.

**Meta**

- [Encode Lessons in Structure](principles/encode-lessons-in-structure.md). Writing the same instruction a second time, or noticing a recurring correction. Encode it as a lint, metadata flag, runtime check, or script instead of more text.

Two former principles live elsewhere now. Proceeding on reversible work without asking is CLAUDE.md's Authorization and ownership section. Keeping large output out of the coordinator's context is the [execution reference](execution.md), under Ordinary delegation and Worker contract.
