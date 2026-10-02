### Worktree and simulator cleanup

**Audit first. Delete only an explicitly approved set.** A disk-usage question is read-only. Untracked and ignored files may be valuable even when the branch is merged.

1. Record available disk space with the host's native tools. Resolve the repository and profile root, then run `bun "<profile>/tools/workflow/worktree-audit.ts" "<repository>" --base <local-base-ref> --json`. Read paths from `git worktree list`, not guessed directory names. The helper reads local Git state and does not fetch or establish remote PR status.
2. Treat every bucket as advice. Inspect branch/head, merge evidence, tracked changes, untracked and ignored files, and real disk usage. Unknown activity metadata means hold for investigation. Ask which native sessions or worktrees are still in use when the scoped task artifacts cannot establish that. Do not invent a pinned-chat API or scan unrelated private history.
3. List exact resolved candidate paths, their contents at risk, and evidence that each is no longer needed. Verify that every path belongs to the intended repository/worktree root. Confirm the explicit deletion grant covers those paths before any removal. A merged branch alone is insufficient.
4. Prefer `git worktree remove <exact-path>` after approval. Do not force a dirty worktree away. If the user explicitly authorizes discarding its listed contents, verify the resolved target again and use the exact approved operation. On Windows use native PowerShell with `-LiteralPath` for leftover files; never pass enumerated paths to another shell. Run `git worktree prune` only after the approved removals.
5. Simulator cleanup applies only on a macOS host with verified `xcrun simctl` support. Inspect the actual device/runtime inventory and active usage, then propose exact stale IDs. Deleting simulators, runtimes, derived data, or package caches requires an explicit target-specific grant. Do not remove profile/session data as a cache.
6. Re-list worktrees and measure disk space afterward. Report the approved removals, measured space reclaimed, and each held candidate with its reason.

**Reply:** before/after disk space, exact paths removed, and evidence or uncertainty for held candidates.
