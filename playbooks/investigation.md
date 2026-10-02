### Investigation

**You own the answer. Plan, route, write.**

Investigation requests are read-only. They produce a cited explanation or a recommendation, not a code change.

1. Route through the **how** skill. For motivation questions, also route through the **why** skill. For version-specific behavior of an external package, SDK, CLI, or API, use the **source-docs-researcher** agent.
2. Choose execution through [the execution reference](../references/execution.md). Direct tools or a few explorers fit a narrow question. A substantial partitioned audit or source investigation can use native independent batches followed by verification and synthesis. Define the coverage boundary and retain unresolved or missing evidence as gaps; read-only work does not mean coordination is unnecessary.
3. Produce the `how`-shaped output (Overview / Key Concepts / How It Works / Where Things Live / Gotchas) for a mechanics question, the `why` skill's output (evidence, inference, competing hypotheses, unknowns, and Sources Consulted, with its confidence language intact) for a motivation or history question, or a recommendation with a tradeoffs table if the request is a decision between alternatives. A question that needs both keeps each part in its own shape.
4. Apply the **edit-prose** skill to the reply.

Use `architect` for an unresolved consequential design question, even when the deliverable is a read-only recommendation. No PR or babysit. Implement only when requested; route authorized implementation to Bug fix or Feature.

**Reply:** the investigation output. For "are we sure?" answers, include your real judgment with reasons. If the premise is wrong, say so and push back. A recommendation is a judgment, not a validation, so agreement is not the default.
