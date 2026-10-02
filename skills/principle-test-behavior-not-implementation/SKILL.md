---
name: principle-test-behavior-not-implementation
description: "Apply when you write, change, or keep a test. Exercise a real behavior or contract and assert an independently specified result or effect. Judge what the assertion proves for its input, not the matcher name."
---

# Test Behavior, Not Implementation

A behavioral test calls the code the way its users do and asserts the result or effect they observe against an independently specified expectation. Interaction, data, and type assertions can also verify real contracts; identify which contract each test protects.

The check: name a concrete defect the test must catch, then inspect its input and assertion. When `undefined` violates the subject's contract, ask whether that wrong result would fail the test. For a void operation, check the required side effect instead. This is one diagnostic, not a universal test-quality rule. Keep the assertion library, runner, and fixtures intact when reasoning about a broken subject.

**Why:** A passing test is useful only when its assertions can reject a relevant defect. Assertions that merely repeat the implementation can preserve its mistakes or obstruct harmless changes.

**Patterns to inspect, not matcher bans:**

- **Incomplete assertion.** Standard `toBeDefined`, `toBeTruthy`, and `toBeGreaterThan(0)` assertions reject `undefined`; `toBeInstanceOf` does too for ordinary constructors. These checks may still miss a wrong value that satisfies the same condition. Add precision when the contract requires it.
- **Interaction or absence only.** Call counts and absence assertions can protect genuine contracts. Check the relevant input, payload, or effect. `toEqual([])` and `toHaveLength(0)` reject `undefined`; an empty result is not inherently a weak assertion. Pair negative cases with positive coverage when the distinction matters.
- **Self-referential expectation.** `expect(f(a)).toBe(f(a))` can pass when both calls return the same wrong value, including `undefined`. A relation between distinct operations can be meaningful, but needs cases that expose shared mistakes.
- **Implementation pin.** A literal public-default assertion can protect a contract. An internal constant or prompt-text pin needs a concrete requirement; otherwise prefer testing the behavior it controls.
- **Fixture asserts fixture.** Confirm the test exercises the subject or a specified data/type contract, rather than only checking values the test itself constructed.

**The fix:** use a concrete input and assert its expected output or observable effect, such as `expect(slugify("Hello, World!")).toBe("hello-world")`. Add the boundary or contrasting case the contract needs. Strengthen or remove tests that protect no meaningful requirement; do not delete a valid test solely because of its matcher.

**Keep** data-relation and compile-time tests that protect a concrete contract, such as required keys shared across tables, valid parent references, or a public type guarantee in a `*.test-d.ts` file. Judge their requirement and failure cases like any other test.
