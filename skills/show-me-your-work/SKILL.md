---
name: show-me-your-work
description: "Keep a reviewable decision trail for long-running or unattended work: a TSV log with one row per decision (what, why, evidence, result). Local by default; commit it when a reviewer needs the trail to trust the result. Use for /show-me-your-work, autonomous or multi-phase runs, or work a human reviews after stepping away."
---

# Show me your work

Keep one canonical log.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). This log records decisions and accepted evidence, not a duplicate worker scheduler. Assigned reviewers audit the given run without rerouting or launching another audit procedure.

## The format

A single TSV file, one row per decision. Cells stay single-line. Evidence is a pointer, not prose.

Copy `references/decision-log-template.tsv` (the header row) to start a clean log. Columns:

- **ts.** ISO8601 timestamp.
- **phase.** The phase or workstream.
- **decision.** What was chosen or done, one line.
- **why.** The reason in plain words. If a principle drove it, say it plainly, not as a jargon tag.
- **evidence.** A link or path that proves it: commit SHA, PR number, `file:line`, or an artifact, trace, or screenshot path. Never a paragraph.
- **result.** The outcome or predicate state: `tests green`, `reverted`, `pixel-diff 0`, `INCONCLUSIVE`, `open`.

An example, plain-spoken so a reviewer reads it at a glance.

```
ts	phase	decision	why	evidence	result
2026-05-24T09:02:00Z	frame	counted the work first, about 100 components and roughly 75 hours	wanted to know the size before starting a long run	commit 3a9f1c2	found 5 things to sort out before starting
2026-05-24T09:40:00Z	harness	took screenshots of the old version before changing anything	so we can compare old against new and catch any visual change	scripts/snapshot.sh, baseline/	saved 120 reference screenshots
2026-05-24T11:15:00Z	widget	moved the widget styles over without changing how it looks	keep the change small and the result identical	commit 7c21e0a, pixel-diff 0	looks identical, tests pass
2026-05-24T12:30:00Z	widget	threw out a helper's work because its screenshots were blank	checked the real files instead of trusting its summary	screenshots/widget-blank.png	reverted, tightened the instructions for next time
```

## Logging a row

Write each entry the way you'd tell a teammate what you did. Plain words, concrete actions, no AI speak or abstract jargon (the **edit-prose** skill applies to log text too).

Resolve `${CLAUDE_SKILL_DIR}/../../tools/workflow/decision-log.ts` and use `bun <absolute-script> <logfile> <phase> <decision> <why> <evidence> <result>`. It stamps `ts`, serializes header creation and appends, strips stray tabs/newlines, and prefixes any cell starting with `=`, `+`, `-`, or `@` with a single quote. Use the helper for every writer. If its short file guard remains after an interruption, confirm no writers still use that log before proposing removal of the exact reported guard directory; a busy guard is not permission to bypass serialization.

Log decision points and checkpoints, not every action: a fork chosen, a unit completed with its verification result, a pivot or revert with its trigger, a blocker surfaced, a gate fixed. For loop runs, one row per iteration. Skip the trivial and self-evident.

A run is one agent conversation, including its later turns and any summary of it. A pickup, a replacement agent, or a new chat starts a new run. When a run adds to a log that already has rows, its first row has phase `start`, and so does its first row after another run's `start` row. So a run that comes back to a log in a later turn first reads the log's last rows to see whether another run wrote since. A `start` row names the `ts` range of the rows before it that this run did not write, and its evidence names this run, such as its agent id. Use phase `start` for nothing else.

## Where it lives

By default the log is a working artifact, not committed. Keep it at `decisions.tsv` in the work dir, or `.audit/<task-slug>.tsv` when several efforts run at once, and leave it out of git: when it sits inside a repository's working tree, add its path relative to the worktree root, with a leading `/`, to the file `git rev-parse --git-path info/exclude` names (one file shared by every worktree of the repository), so no commit, including a commit-agent run or a pause checkpoint, picks it up. When the condition below calls for committing it, keep that line and have the commit-agent stage the log with `git add -f -- <path>`.

Commit it only when the work is ambitious enough that a reviewer needs the trail to trust the result.

## Rules

- Append-only. A wrong call gets a new row that supersedes it. Never edit or delete history.
- Prefer evidence produced by committed scripts over hand-made one-offs (the **principle-encode-lessons-in-structure** principle skill).

## Audit the log against the transcript

At the end of the run, before handing back, check that the log told the truth. Use the current task's conversation and captured tool evidence. If a stored transcript is needed, resolve this session's transcript under the active profile's `projects/` directory from the session id and workspace metadata, then read only the segments relevant to this task and run. This verifies current work; it does not authorize searching historical sessions or unrelated transcript segments. If the transcript is unavailable, disclose that and audit against the active session and captured tool output. Walk only this run's rows against what actually happened. Each stretch begins at this run's `start` row, or the first row if this run created the log, and ends immediately before another run's next `start` row:

- Check that every row maps to a real decision or action.
- Check that each row's evidence resolves and shows what the row claims.
- A fork, pivot, or abandoned approach that shaped the work but isn't logged is a gap. Add it.

Correct the log, not the story. The audit never edits or removes a row, even an invented one. When a row records neither a real decision nor a real action, or its claim or evidence is wrong, add a row that supersedes it with what actually happened and a pointer that resolves. This audit does not check rows outside this run's stretches. If this run's own work shows one of them is wrong, supersede it like any wrong call.

## Independent review of the trail

Before handing back, assign a fresh-context read-only reviewer through the selected executor, with resolved evidence paths and the same task/run boundary. Self-review is not a substitute. The reviewer reads the audit trail and the current run's tool calls and results, the artifact this audit checks, without the implementer's reasoning text, then flags what the user should pay attention to. Keep unrelated history outside the assignment. This is a scan for unsupported or risky work, not a redo of the implementation. A missing review remains open rather than "No flags."

- Decisions logged with weak or absent evidence.
- Verification steps skipped or claimed without proof in the transcript.
- Choices that look risky in hindsight (premature, scope-creeping, papering over a symptom).
- Gaps the user would otherwise miss on a casual skim.

Every reply for a run that produced a trail ends with an "Attention" section. Identify the independent reviewer and its scope, then list each flag pointing to specific rows or moments. "No flags" is a valid value. Do not claim a different model family when the reviewer inherited the same model.

## Reviewing the trail

Read top to bottom, follow the evidence pointers, spot-check. GitHub renders a committed TSV as a table. `column -s$'\t' -t decisions.tsv` renders it in a terminal.

## Composing this skill

Other skills route their audit trail here instead of inventing one. Reference it by name and let it own the format. Don't restate the columns.
