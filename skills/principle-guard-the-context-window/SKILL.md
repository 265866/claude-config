---
name: principle-guard-the-context-window
description: "Apply when context is filling up: large outputs, long files, repeated reads, fan-out planning. Only the main coordinator delegates work that would produce large outputs within authorized scope; workers use targeted reads and compact summaries or return a concrete capacity blocker."
---

# Guard the Context Window

The context window is finite and non-renewable within a session. Every token should be worth its cost.

**Why:** Context overflow degrades reasoning quality, creates compression artifacts, and halts progress.

**Pattern:**
- **Isolate large payloads.** Only the main coordinator may delegate verbose outputs, screenshots, and large documents to scoped subagents when delegation is authorized. Keep summaries and artifact pointers in the main thread.
- **Stay within the assignment.** Workers use targeted reads and compact summaries. If the assigned stage exceeds capacity, return a concrete blocker; never widen the stage or add delegation.
- **Keep frequently used content inline.** Guidance the invoking agent itself needs on every invocation belongs in the skill file, not in separate files that cost a read each time. Worker prompt templates are the exception: keep them in `references/` so they can be resolved and handed to the workers that use them.
- **Size phases and cap scope.** Limit files per phase, set turn budgets, account for mechanism costs.
