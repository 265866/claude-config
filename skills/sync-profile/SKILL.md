---
name: sync-profile
description: Use when Colton says "sync profile" or asks to sync his Claude profile across his machines. Commits this profile's changes on main, pushes them, fast-forwards the profile on his other machines, and checks that every machine matches.
---

# Sync profile

The profile is the root of this Claude Code profile, a clone of `265866/claude-config` at `~/.claude` on each of Colton's machines. Those machines are colton-desktop (Windows), moss (`ssh moss`), and the MacBook (`ssh macbook`). Find the current one with `hostname`, and treat the other two as the other machines. Pushing `main` needs Colton's own request to sync, as CLAUDE.md says.

Run every git command that reaches GitHub, and every `ssh`, without prompts, as [rules/toolchains.md](${CLAUDE_SKILL_DIR}/../../rules/toolchains.md) says for credentials. Add `-o BatchMode=yes -o ConnectTimeout=10` to `ssh`.

1. **Check the branch.** The profile must be on `main`. On any other branch, stop and report it, because a task branch reaches `main` through its PR.
2. **Commit.** When `git status` shows changes, run the tests for what changed: `bun test` in `tools/workflow` for `tools/`, and `bun test hooks/` for `hooks/`. A failing test stops the sync. Then commit the changes through the commit-agent agent.
3. **Push.** Run `git pull --rebase origin main`, then `git push origin main`. When the rebase conflicts, run `git rebase --abort`, stop, and report the conflicting files.
4. **Pull on the other machines.** On each machine you can reach over `ssh`, check that its profile is on `main`, and skip and report it when it is not. Then run `git -C ~/.claude pull --ff-only origin main` there. Git refuses a pull that would overwrite that machine's own edits or that cannot fast-forward. Report that refusal with the machine's `git status --short`, and leave its edits alone. For a machine you cannot reach, report the command to run there.
5. **Report.** Give a table with each machine, its `git rev-parse --short HEAD`, and whether it matches `origin/main`, plus what step 2 committed.
