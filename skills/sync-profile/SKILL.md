---
name: sync-profile
description: Use when Colton says "sync profile" or asks to sync his Claude profile across his machines. Commits this profile's changes on main, pushes them, fast-forwards the profile on his other machines, and checks that every machine matches.
---

# Sync profile

This profile is a clone of `265866/claude-config` at `~/.claude` on each of Colton's machines. Those machines are colton-desktop (Windows), moss (`ssh moss`), and the MacBook (`ssh macbook`). Find the current one with `hostname`, and treat the other two as the other machines. Pushing `main` and fast-forwarding the other machines need Colton's own request to sync the profile across his machines, as CLAUDE.md says.

Run every command in `~/.claude` on whichever machine it runs, for example `git -C ~/.claude status`, whatever project this session started in. Run every git command that reaches GitHub, and every `ssh`, without prompts, as [rules/toolchains.md](${CLAUDE_SKILL_DIR}/../../rules/toolchains.md) says for credentials. On another machine, run each command as `ssh -o BatchMode=yes -o ConnectTimeout=10 <host> '<command>'`, with the command in single quotes so `~` expands on that machine.

1. **Check the branch.** The profile must be on `main`. On any other branch, stop and report it, because a task branch reaches `main` through its PR.
2. **Commit.** When `git status` shows changes, run the checks for what changed: `bun test` and `bun run typecheck` in `~/.claude/tools/workflow` for `tools/`, and `bun test hooks/` for `hooks/`. First run `bun install --frozen-lockfile` in `~/.claude/tools/workflow`, so its dependencies match its lockfile. When a check fails, stop and report it. A sync commits the profile as it stands, so skip clean-code and have the commit-agent agent commit all the changes on `main` in `~/.claude`. When it leaves anything uncommitted, stop and report it.
3. **Push.** Run `git pull --rebase origin main`, then `git push origin main`. When the rebase conflicts, resolve it with the resolving-merge-conflicts skill before pushing.
4. **Pull on the other machines.** On each machine you can reach over `ssh`, check that its profile is on `main`, and skip and report it when it is not. Then run `git -C ~/.claude pull --ff-only --no-rebase --no-autostash origin main` there. Git refuses a pull that would overwrite that machine's own edits or that cannot fast-forward. Report that refusal with the machine's `git status -sb`, and leave its edits alone. For a machine you cannot reach, report the command to run there.
5. **Report.** Give a table with each machine, its `git rev-parse --short HEAD`, whether that is the commit step 3 pushed, and its `git status --short` when that is not empty. Add what step 2 committed.
