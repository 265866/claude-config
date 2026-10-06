# Engineering principles
Use this catalog for substantial engineering or design work. Read only the leaf skills relevant to the current decision. A worker applies the assigned stage's principles without restarting coordinator routing.

**Core**

- **Laziness Protocol** ([principle-laziness-protocol](../skills/principle-laziness-protocol/SKILL.md)). Refactoring, sizing a diff, or tempted to add abstractions, layers, or signal threading. Bias to deletion and the smallest change that solves the problem.
- **Foundational Thinking** ([principle-foundational-thinking](../skills/principle-foundational-thinking/SKILL.md)). Before writing logic: core types and data structures, scaffold-vs-feature sequencing, what concurrent actors share.
- **Redesign from First Principles** ([principle-redesign-from-first-principles](../skills/principle-redesign-from-first-principles/SKILL.md)). Integrating a new requirement into an existing design. Redesign as if it had been foundational from day one.
- **Attack the Premise** ([principle-attack-the-premise](../skills/principle-attack-the-premise/SKILL.md)). Two or more fixes that share one premise have failed the same gate. Take a census of which actors hold the imbalance before the next fix, then question the premise instead of writing another fix that assumes it.
- **Subtract Before You Add** ([principle-subtract-before-you-add](../skills/principle-subtract-before-you-add/SKILL.md)). Sequencing an addition, refactor, or rewrite. Remove dead weight first, then build on the simpler base.
- **Minimize Reader Load** ([principle-minimize-reader-load](../skills/principle-minimize-reader-load/SKILL.md)). Reviewing or shaping code that's hard to trace. Count layers and hidden state, collapse one-caller wrappers, shrink mutable scope.
- **Outcome-Oriented Execution** ([principle-outcome-oriented-execution](../skills/principle-outcome-oriented-execution/SKILL.md)). Planned rewrites and migrations with explicit phase boundaries. Converge on the target architecture. Don't preserve throwaway compatibility states.
- **Experience First** ([principle-experience-first](../skills/principle-experience-first/SKILL.md)). Product, UX, or feature-scope tradeoffs. Choose user delight over implementation convenience.
- **Exhaust the Design Space** ([principle-exhaust-the-design-space](../skills/principle-exhaust-the-design-space/SKILL.md)). A novel interaction or architectural decision with no precedent. Build 2-3 competing prototypes and compare before committing.
- **Build the Lever** ([principle-build-the-lever](../skills/principle-build-the-lever/SKILL.md)). Repeated transformations or fragile verification that an existing command cannot cover. Use the smallest reusable tool that earns its maintenance cost.

**Architecture**

- **Model the Domain** ([principle-model-the-domain](../skills/principle-model-the-domain/SKILL.md)). Writing stateful logic, or code that branches a lot or repeats a shape assumption across files. Encode the domain in a structure (state machine, typed model, table or registry, reducer, boundary, the right collection) instead of scattered conditionals.
- **Boundary Discipline** ([principle-boundary-discipline](../skills/principle-boundary-discipline/SKILL.md)). Wiring validation, error handling, or framework adapters. Guards at system boundaries, trust internal types, keep business logic pure.
- **Type System Discipline** ([principle-type-system-discipline](../skills/principle-type-system-discipline/SKILL.md)). Designing types or a signature in any typed language. Make illegal states unrepresentable, brand primitives, parse external data at boundaries.
- **Make Operations Idempotent** ([principle-make-operations-idempotent](../skills/principle-make-operations-idempotent/SKILL.md)). Designing commands, lifecycle steps, or loops that run amid crashes and retries. Converge to the same end state.
- **Migrate Callers Then Delete Legacy APIs** ([principle-migrate-callers-then-delete-legacy-apis](../skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md)). Introducing a new internal API while old callers exist. Migrate and delete in one wave.
- **Separate Before Serializing Shared State** ([principle-separate-before-serializing-shared-state](../skills/principle-separate-before-serializing-shared-state/SKILL.md)). Concurrent actors might write the same file, branch, key, or object. Eliminate the sharing first.

**Verification**

- **Prove It Works** ([principle-prove-it-works](../skills/principle-prove-it-works/SKILL.md)). After a task, before declaring done. Verify against the real artifact, not a proxy or "it compiles".
- **Fix Root Causes** ([principle-fix-root-causes](../skills/principle-fix-root-causes/SKILL.md)). Debugging. Trace each symptom to its root cause, reproduce first, ask why until you reach it.
- **Sequence Work into Verifiable Units** ([principle-sequence-verifiable-units](../skills/principle-sequence-verifiable-units/SKILL.md)). Multi-step work (sweeps, migrations, runs of similar edits) and how you stack commits and PRs. Verify prerequisites before dependent work and each unit before acceptance. Independent units can run in parallel; check their combined result before integration.
- **Test Behavior, Not Implementation** ([principle-test-behavior-not-implementation](../skills/principle-test-behavior-not-implementation/SKILL.md)). Writing, changing, or keeping a test. Exercise a real behavior or contract and assert an independently specified result or effect. Name the defect the assertion must catch; judge its actual coverage rather than its matcher name.
- **Explain the Number** ([principle-explain-the-number](../skills/principle-explain-the-number/SKILL.md)). Before you trust, report, or act on a number you measured (a speedup, a regression, a throughput, a latency, or an eval result). Find what limits it, and rule out that it measured something other than the work you think.

**Delegation**

- **Guard the Context Window** ([principle-guard-the-context-window](../skills/principle-guard-the-context-window/SKILL.md)). Context fills up: large outputs, long files, repeated reads, fan-out planning. Coordinators delegate bulky investigation within scope. Workers use targeted reads and report capacity blockers without creating another delegation tree.
- **Never Block on the Human** ([principle-never-block-on-the-human](../skills/principle-never-block-on-the-human/SKILL.md)). Tempted to ask "should I do X?" on reversible work. Proceed, present the result, let the human course-correct.

**Meta**

- **Encode Lessons in Structure** ([principle-encode-lessons-in-structure](../skills/principle-encode-lessons-in-structure/SKILL.md)). You catch yourself writing the same instruction a second time. Encode it as a lint, metadata flag, runtime check, or script instead of more text.
