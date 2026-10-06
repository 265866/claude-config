---
name: recall
description: "Reconstruct working context from scoped chat history and verify current state. Use for 'catch me up', 'what have I been working on', 'where did I leave off', or requests to recall prior work, catch up on a named thread, summarize recent activity, or resume work whose context is missing. Do not mine history before unrelated tasks or when a supplied state capsule is sufficient."
---

# Recall

**When the user requests prior context or a resumption needs missing context, reconstruct the authorized thread and hand back a tight capsule of where things stand.** This is not a prerequisite to ordinary work.

Keep it tight and on-topic. Read only what the in-scope threads need, then stop.

Chat history records what the user and agent did and decided. Current repository and already-authorized shared records can establish what changed afterward. Use the **why** evidence contracts when that external context is needed to answer the request; naming a feature does not authorize a broad private-source sweep.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). Small searches stay direct; broad scoped corpora can be partitioned. History workers inspect their assigned source slices without rerouting the task, expanding the scope, or collecting memory.

Claude Code transcripts live under the active profile's `projects/` directory. Resolve the active profile using the loaded profile CLAUDE.md's resource definition: `CLAUDE_CONFIG_DIR` when set, otherwise the directory containing that CLAUDE.md. Then locate the current project by its working-directory and session metadata. Main session records are JSONL; child-agent records may be under `<session-id>/subagents/`. Inspect actual records before selecting message fields. Search only the user-authorized workspace and time window.

1. Respect the requested result. One specific prior chat to resume uses the `session-pickup` playbook. A recent-activity summary stays a summary rather than initiating work. If the user already supplied enough state (paths, branch, change, open work), use it and skip mining. Search additional history only for the missing context within the request.
2. Lock the scope before searching. Pin the window ("recent" is a real range, default the last 7 days), the topic if named, and the workspace (default the active one. Never read another project's transcripts without being asked). State the scope back. Never quietly turn "all" into "recent N".
3. Search the scoped corpus directly for one or two chats; otherwise partition independent slices using the selected executor. Order candidates by real filesystem modification time, never UUID name. Search the topic first, then read matching chats and their relevant regions. Skip the current chat and obvious subagent, eval, and test noise. Each read-only assignment has absolute transcript paths and returns one block per chat: topic, user goal, decisions, open threads, struggles and corrections, and artifacts, citing the chat UUID. Pass findings rather than raw transcripts into synthesis, and account for every selected slice.
4. Consult shared records only when the requested current state or a surfaced uncertainty needs them. Use `why`'s scope-first source selection with the question "what is the current state and what relevant attempts failed?" Consult only relevant sources authorized for that action. Record empty searches and relevant unavailable sources. Pure activity recall normally needs only the scoped history and local live state.
5. Verify against live state. Take the PRs, branches, and tickets that the mining and the sweep surfaced and check them with local `git` and already-authorized read-only `gh` access. Connect only an already-available read-only tool, and report it. Do not mutate external records. When the answer hinges on what an agent actually did (the tools it ran, files it read, errors it hit), read the full transcript, not just a trimmed local copy.
6. Write the brief to the contract below. Group by thread. Stay on the named topic.

## Output contract

Lead with the capsule, then the thread status, then the problems, then the next move. Deeper detail goes below or gets cut.

- **Capsule.** At most 5 bullets. What this work is and where it stands overall.
- **Threads.** One line each, prefixed with exactly one status tag: `[merged #N]`, `[open PR #N]`, `[in flight <branch>]`, `[verified, uncommitted]`, `[reverted #N]`, `[planned, not started]`, or `[unknown, <missing evidence>]`. When more than one tag fits, use the one describing the current state (for example `[reverted #N]` over `[merged #N]`, and `[open PR #N]` over `[in flight <branch>]`). Derive the status from actual evidence; unavailable live state cannot justify a completion claim.
- **Problems.** At most 5, the recurring ones. Include the symptoms users keep reporting and any fix that shipped and was reverted, so the next attempt starts where the last one failed.
- **Next move.** The single most useful next action, concrete.

An adjacent feature or ticket stays out unless it blocks this one. When the capsule and thread lines outgrow a screen, cut detail before you cut threads. Write the brief through the **edit-prose** skill, cite chat findings by UUID and shared-record findings by their source (PR #, ticket ID, chat permalink, error-tracker issue), and sanitize private context before any public output.

**Reply:** the brief, to the contract above.
