---
name: clean-code
description: Simplify a scoped diff, remove unnecessary comments and defensive code, and resolve type workarounds while preserving behavior and repository style.
---

# Clean code

Review the scoped diff against the actual base branch. Remove unnecessary code and patterns that conflict with the surrounding design. Style is not evidence of authorship. A review-only request produces findings without edits.

## Focus Areas

- Extra comments that are unnecessary or inconsistent with local style
- Defensive checks or try/catch blocks that are abnormal for trusted code paths
- Casts to `any` used only to bypass type issues
- Deeply nested code that should be simplified with early returns
- Other patterns inconsistent with the file and surrounding codebase

## Guardrails

- Preserve behavior in the simplification itself. Fix a bug you find as its own verified change when it is in the task's scope (CLAUDE.md, Authorization and ownership); in a review-only request, report it. Do not remove a defensive check without verifying its boundary and callers.
- Prefer minimal, focused edits over broad rewrites.
- Run the relevant real behavior checks, edge or regression case, and configured type, build, format, and lint gates. Report unavailable checks honestly.
- Keep the final summary concise (1-3 sentences).
