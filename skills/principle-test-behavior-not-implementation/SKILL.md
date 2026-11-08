---
name: principle-test-behavior-not-implementation
description: "Apply when you write, change, or keep a test. Exercise a real behavior or contract and assert an independently specified result or effect. Judge what the assertion proves for its input, not the matcher name."
---

# Test Behavior, Not Implementation

A behavioral test calls the code the way its users do and asserts the result or effect they observe against an independently specified expectation. Interaction, data, and type assertions can also verify real contracts; identify which contract each test protects.

Judge each test against two imagined edits. Keep the assertion library, runner, and fixtures intact in both.

- **Break the behavior.** Make the code return a wrong value, skip an effect, or do the effect twice. The test must fail. If it still passes, it proves nothing.
- **Change only the internals.** Keep every observable result the same and restructure the code underneath. The test must still pass. If it fails, it is pinned to the implementation, needs a rewrite on every refactor, and still catches no bug.

**Why:** A passing test is useful only when its assertions can reject a relevant defect. Assertions that merely repeat the implementation can preserve its mistakes or obstruct harmless changes.

**Patterns to inspect, not matcher bans:**

- **Incomplete assertion.** Standard `toBeDefined`, `toBeTruthy`, and `toBeGreaterThan(0)` assertions reject `undefined`; `toBeInstanceOf` does too for ordinary constructors. These checks may still miss a wrong value that satisfies the same condition. Add precision when the contract requires it.
- **Interaction or absence only.** Call counts and absence assertions can protect genuine contracts. Check the relevant input, payload, or effect. `toEqual([])` and `toHaveLength(0)` reject `undefined`; an empty result is not inherently a weak assertion. Pair negative cases with positive coverage when the distinction matters.
- **Self-referential expectation.** `expect(f(a)).toBe(f(a))` can pass when both calls return the same wrong value, including `undefined`. A relation between distinct operations can be meaningful, but needs cases that expose shared mistakes.
- **Implementation pin.** A literal public-default assertion can protect a contract. An internal constant or prompt-text pin needs a concrete requirement; otherwise prefer testing the behavior it controls.
- **Fixture asserts fixture.** Confirm the test exercises the subject or a specified data/type contract, rather than only checking values the test itself constructed.

The contract decides, not the shape of the assertion. When "an empty cart never charges" is the promise, an assertion that the payment client got no call is behavior. Pair it with a case where the charge happens, so that the test shows it can see a call. The payload that a mocked external service receives is behavior, because that service observes it. A call to an internal helper is implementation, because no user can see it. An empty list is the exact answer when no record matches, and a hollow check when the test only needs some result. An exact error message pins wording that no caller reads. The error type that callers branch on is the contract.

**The fix:** use a concrete input and assert its expected output or observable effect, such as `expect(slugify("Hello, World!")).toBe("hello-world")`. Add the boundary or contrasting case the contract needs. Strengthen or remove tests that protect no meaningful requirement; do not delete a valid test solely because of its matcher.

**Keep** data-relation and compile-time tests that protect a concrete contract, such as required keys shared across tables, valid parent references, or a public type guarantee in a `*.test-d.ts` file. Judge their requirement and failure cases like any other test.
