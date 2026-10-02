---
name: principle-encode-lessons-in-structure
description: "Apply when you catch yourself writing the same instruction a second time, or notice a recurring correction. Encode the rule as a lint, metadata flag, runtime check, or script instead of more text."
---

# Encode Lessons in Structure

Encode recurring fixes in mechanisms (tools, code, metadata, automation) instead of textual instructions. Every error, human correction, and unexpected outcome is a learning signal. Capture it, route it, and close the loop.

**Why:** Textual instructions are easy to miss. They require the reader to notice, remember, and comply. Structural mechanisms (lint rules, metadata flags, runtime checks, automation scripts) enforce the rule without cooperation.

**Pattern:**
When you catch yourself writing the same instruction a second time:
1. Ask: can this be a lint rule, a metadata flag, a runtime check, or a script?
2. If yes, encode it. Delete the instruction
3. If no (requires judgment), make the instruction more prominent and add an example of the failure mode

**Pick the strongest mechanism.** When more than one mechanism would work, choose the strongest the situation allows (an unrepresentable state that cannot compile, then a lint or banned API that fails CI, then a canonical helper, then a runtime check), because agents copy whatever the surrounding code already does and a weaker guard becomes the next template.

**Corollary:** If the fix is structural, only use the structural fix. The instruction is the symptom.

**Feedback loop:**
- **Capture every correction.** When the human intervenes or tests fail, decide if it's a one-off or a pattern.
- **Route to the right layer.** One-off -> current task note. Recurring fix in the project you are working on -> that project's lint rule, test, type, or script, within the task's scope. Recurring fix to agent instructions -> a proposed skill or principle edit. Systemic issue -> a proposed principle.
- **Close the loop.** Don't just record. Apply project-scope encodings now when the task authorizes them. Changes to installed skills, principles, or this profile happen only in requested profile maintenance (such as the **reflect** skill's approval step). During other work, put the concrete proposed edit in the task report instead of applying it. Never write automatic memory.

**Anti-patterns:**
- Acknowledging without recording ("I'll keep that in mind" does not persist; put it in the task note or report)
- Recording without routing (a current task note about a lint rule that should exist is wasted unless the lint rule gets implemented)
- Fixing without generalizing (fixing one instance while leaving the recurring pattern intact)
