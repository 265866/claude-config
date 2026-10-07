---
name: resolving-merge-conflicts
description: Resolves each conflicting hunk from the original intent of both sides, runs the project's checks, and finishes the merge or rebase, stopping to ask only when a hunk needs a product decision or the user withdrew authorization for the operation or for work it depends on. Use when you need to resolve an in-progress git merge/rebase conflict.
---

# Resolving merge conflicts

1. **See the current state** of the merge/rebase. Check git history, and the conflicting files. Check the [resume marks](${CLAUDE_SKILL_DIR}/../../playbooks/pause-safely.md#resume-marks). If they hold this operation as withdrawn or blocked by withdrawal, directly or through its change, its branch, or a withdrawn PR below its branch in the stack, leave it untouched and ask the user before resolving it. Run the owning playbook's review on files they mark unreviewed before step 5.

2. **Find the primary sources** for each conflict. Understand deeply why each change was made, and what the original intent was. Read the commit messages, PRs, and linked issues or tickets through access you already have. Connect an already-available read-only tool when it helps, and report it.

3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal and note the trade-off. Do **not** invent new behavior. Resolve every hunk the evidence settles. When a hunk needs a product or preference decision that evidence cannot settle, leave the merge or rebase in progress with the settled hunks resolved, and ask about that hunk with both intents and a recommendation. Never `--abort` on your own, because it discards the resolution work; abort only when the user asks.

4. Discover the project's **automated checks** and run them in the order `rules/toolchains.md` sets: the narrow behavior check for the conflicted code first, then the configured type, build, format, and lint gates and relevant tests. Fix anything the merge broke.

5. **Finish the merge/rebase.** Stage the resolved files and complete the in-progress operation with its own non-interactive command (`git commit --no-edit` for a merge; for a rebase, `GIT_EDITOR=true git rebase --continue` in bash, or `$env:GIT_EDITOR='true'` and then `git rebase --continue` in PowerShell, because `GIT_EDITOR` overrides `core.editor`) until all commits are applied. This completion commit belongs to this skill rather than the commit-agent, which stops on an in-progress merge. Push the result per CLAUDE.md (Authorization and ownership).