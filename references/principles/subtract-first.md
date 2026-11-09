# Subtract First

Apply when sizing a diff, sequencing an addition, refactor, rewrite, or migration, introducing a new internal API while old callers exist, or when tempted to add an abstraction, a layer, or signal threading.

Aim for the most result with the least code and complexity. Remove complexity first, then build. Converge on the end state instead of keeping old and new paths alive side by side.

**Why:** Adding to a complex system compounds complexity. Removing first leaves less code, reveals the essential structure, and usually makes the next design obvious. Compatibility layers and smooth intermediate states turn into long-lived debt, and dual paths make the codebase feel append-only.

## Make the smallest change

- **Minimize the diff.** Make the smallest change that solves the problem. Fewer lines beat "elegant" boilerplate.
- **Maintain a flat call hierarchy.** Avoid deep call chains. A rich interface that hides substantial work is not a deep call chain. If answering a question requires tracing through more than 3 files or layers, flatten it.
- **Consolidate decisions.** Do not repeat the same choice in several places. Put it behind one source of truth and pass the result as a simple flag.
- **Question the threading.** If a task asks you to pass a new signal through types, schemas, pipelines, or similar layers, stop and look for a more direct path.
- **Sweat the small leaks.** Remove tiny pass-throughs, representation leaks, and duplicated choices before they spread. Small leaks compound into permanent coordination costs.

**The test:** If a human developer would find the code exhausting to maintain, it is a bad solution.

## Remove before you build

Default to subtraction. When asked to refactor or improve, look for removals before additions. Make simplification a continual investment. Leave the design slightly simpler and more capable behind the same or smaller surface than you found it.

- Sequence removal before construction.
- Cut before you polish. Get to the minimum before investing in quality.
- Design for observed usage, not speculative edge cases.
- Add no speculative validators, parsers, or guards beyond what the spec demands.
- Simplify prompts. Remove redundant instructions and excessive templates.
- When a reference has no novel content, delete it rather than leaving a stub.

## Migrate callers, then delete the old API

When a new internal API is the right design, migrate its callers and remove the old API in the same wave instead of preserving compatibility layers.

- Do not keep legacy API paths only because internal callers still exist.
- Inventory callers, migrate them, and delete the old API immediately.
- Preserve backward compatibility only when the user explicitly requests it.
- Update tests to assert the new contract, and delete tests that only protect pre-refactor implementation details.

This applies when no external users depend on backward compatibility, the project can absorb coordinated breaking changes, and the new API is part of a simplification or refactor.

## Converge on the end state

In planned rewrites and migrations with explicit phase boundaries, optimize for the intended, verifiable end state rather than for smooth intermediate states. Prove correctness at explicit verification boundaries.

- Prioritize end-state integrity over transitional stability.
- Keep unfinished replacement work isolated until it reaches a verified working state. Preserve the usable product until then.
- Declare where temporary breakage is acceptable. It belongs only inside the isolated branch, worktree, or phase that holds unfinished work, never in a delivered commit or on the usable product. Each delivered unit still passes its checks, per [Sequence Work into Verifiable Units](sequence-verifiable-units.md).
- Keep high-signal checks for actively touched areas while migrating.
- Require full static and runtime verification at plan completion.
