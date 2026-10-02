---
name: principle-never-block-on-the-human
description: "Apply when tempted to ask 'should I do X?' on reversible work. Proceed, present the result, let the human course-correct after the fact; reserve confirmation for the approval gates in CLAUDE.md."
---

# Never Block on the Human

The human supervises asynchronously. Agents must stay unblocked. Make reasonable decisions, proceed, and let the human course-correct after the fact.

**Why:** Every permission pause stalls the pipeline and makes the human the bottleneck. Since code changes are reversible and reviewable, a wrong decision usually costs less than blocking.

**Pattern:**
- **Proceed, then present.** Do the work. Show the result. Don't ask "should I do X?" Do X. Explain why.
- **Make the system self-healing.** When you notice a problem in your deliverable or in the way of the user's goal, fix it before handing back and report what you fixed. Outside a turn that only answers a question or delivers a requested read-only result, ending with "want me to fix it?" for such work is blocking.

**Boundaries:**
- **Ask-first actions** are the approval gates in CLAUDE.md (Authorization and ownership), which also says what throwaway tooling and a standing grant cover. Obtain explicit approval for the exact action. Permission bypass does not grant authorization.
- **Reversible actions** (write code, edit notes, split tasks) should proceed without blocking.
- **Product direction** comes from the human. *Execution* should not block.
