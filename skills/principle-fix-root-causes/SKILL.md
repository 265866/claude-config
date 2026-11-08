---
name: principle-fix-root-causes
description: "Apply when debugging. Trace each symptom back to the first place the system went wrong and fix it there. A guard is a fix only when the state it handles is legitimate."
---

# Fix Root Causes

When debugging, fix the fault, not the place where it surfaced. The symptom is where a wrong state became visible. The root cause is the first place the system did something it should not do, or failed to handle a state it should handle.

**Why:** A symptom fix hides the evidence and leaves the fault free to surface somewhere else. Each one makes the system harder to reason about, because the code now carries a workaround for a bug that nobody named.

**Pattern:**
- Reproduce first
- Ask "why" at each step until the answer is a wrong decision in the code, not a consequence of an earlier one
- Ask whether the state that triggered the symptom is legitimate. If the system may be in that state, the code that broke on it is the root cause, and handling the state there is the fix. If the state should never exist, a check where it broke hides the bug. Find what produced the state. Guards, retries, swallowed errors, clamped values, and discarded state are the usual ways to hide a bug. Containing failures at a real system boundary, such as recovering a panic before it crosses into a host process, is boundary handling (the **principle-boundary-discipline** skill); still fix any fault it catches.
- If a workaround needs a paragraph-long comment to justify it, the code is wrong (fix the code, not the comment)
- When the root cause is upstream, the fix available to you is a verified workaround at the boundary with that dependency, with a short comment naming the upstream bug
- Check for the pattern, not just the instance (grep for the same pattern, fix all instances)
- When stuck, instrument. Don't guess (add logging, read the actual error and the actual state)
- If the deciding fact took a deep dig to find, propose the cheap, always-on signal (a log line, status field, or assertion) that would have shown it at first look

**Restart bugs: suspect state before code**

When something "fails after restart," suspect stale persistent state first: config files, caches, lock files, serialized state. If clearing a state file restores behavior, prioritize state validation as the fix. Test that reversibly: point the app at a copy, or, when the request authorizes changes and the app is not running, move the file aside with a backup. Deleting a user's config or serialized state without a backup is ask-first. Test a suspect cache the same way, against a copy, so the stale state stays reproducible. Clearing a regenerable cache without asking, through the owning tool's clean command or folder removal as CLAUDE.md and playbooks/worktree-cleanup.md describe, applies only when the request authorizes changes; profile and session data are never caches.
