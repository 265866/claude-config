---
name: principle-outcome-oriented-execution
description: "Apply during planned rewrites and migrations with explicit phase boundaries. Converge on the target architecture; don't preserve smooth intermediate states with throwaway compatibility code."
---

# Outcome-Oriented Execution

Optimize for the intended, verifiable end state rather than preserving smooth intermediate states.

**Why:** Keeping every intermediate step fully stable often creates temporary compatibility code that becomes long-lived debt. Converge on the target architecture and prove correctness at explicit verification boundaries.

**Core rule:**
- Prioritize end-state integrity over transitional stability
- Unfinished replacement work stays isolated until it reaches a verified working state; preserve the usable product until then

**Guardrails:**
- Use this for planned rewrites and migrations with explicit phase boundaries
- Declare where temporary breakage is acceptable: inside the isolated branch, worktree, or phase that holds unfinished work, never in a delivered commit or on the usable product. Each delivered unit still passes its checks, per **principle-sequence-verifiable-units**
- Keep high-signal checks for actively touched areas while migrating
- Require full static and runtime verification at plan completion
