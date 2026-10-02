---
name: resolving-merge-conflicts
description: Resolves each conflicting hunk from the original intent of both sides, runs the project's checks, and finishes the merge or rebase. Use when you need to resolve an in-progress git merge/rebase conflict.
---

# Resolving merge conflicts

1. **See the current state** of the merge/rebase. Check git history, and the conflicting files.

2. **Find the primary sources** for each conflict. Understand deeply why each change was made, and what the original intent was. Read the commit messages, PRs, and linked issues or tickets through access you already have; connecting a new private service still needs approval.

3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal and note the trade-off. Do **not** invent new behavior. Always resolve; never `--abort`.

4. Discover the project's **automated checks** and run them in the order `rules/toolchains.md` sets: the narrow behavior check for the conflicted code first, then the configured type, build, format, and lint gates and relevant tests. Fix anything the merge broke.

5. **Finish the merge/rebase.** Stage the resolved files and complete the in-progress operation with its own non-interactive command (`git commit --no-edit` for a merge, `GIT_EDITOR=true git rebase --continue` for a rebase) until all commits are applied. This completion commit belongs to this skill rather than the commit-agent, which stops on an in-progress merge. Pushing the result needs separate approval.