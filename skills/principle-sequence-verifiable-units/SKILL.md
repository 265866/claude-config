---
name: principle-sequence-verifiable-units
description: "Apply to multi-step work (sweeps, migrations, runs of similar edits) and to how you stack commits and PRs. Break work into verifiable units, check prerequisites before dependent work, and order delivery so the sequence proves itself to a reviewer."
---

# Sequence work into verifiable units

Break work into small units, each ending in a state you can check. Verify a prerequisite before building on it. Independent units can run in parallel.

**Why:** A break caught at the unit that caused it is cheap to localize. A break caught after a batch is buried, and you have already built further on a broken base. Sequencing those same units into a delivery a reviewer can replay turns "trust me" into "watch it go red, then green."

**Execution.** Check each unit against its accepted input revision before accepting its result or starting dependent work. Preserve the assigned base, including a supplied parent revision in a stack. Changing that base requires the coordinator's agreement and any applicable user approval. Independent units can run in bounded parallel batches, and a deterministic bulk transformation can cover multiple units. Verify each unit's behavior and check the combined artifact before calling the work integrated.

**Delivery.** Stack commits and PRs in dependency order. Demonstrate a failing regression before applying its fix, then deliver a self-contained, passing change. Other useful orders are a subtraction before the reshape, a baseline capture before the treatment, and the scaffold before the feature. Each commit has its own verification and the sequence reads as an argument.

The sequencing complement to the **principle-prove-it-works** principle skill, which keeps each check real, and the **principle-build-the-lever** principle skill, which makes the per-unit check cheap.
