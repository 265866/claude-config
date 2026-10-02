---
name: reflect
description: "Review the active conversation for durable lessons and propose improvements to existing skills. Use when the user requests reflection, lessons from the session, or instruction improvements. Profile edits require approval of the proposed changes."
---

# Reflect

Review the current conversation for durable lessons, then propose concrete skill improvements. Do not capture memory or modify instructions merely because a lesson appears during other work.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). Reviewers and the synthesizer perform read-only assigned stages without restarting routing or launching another reflection procedure.

## When to invoke

Use when the user requests reflection, lessons learned, or improvements to the instructions based on this session. Skip when the conversation is trivial, off-topic, or already covered by clear guidance the parent followed correctly. One-offs are not durable lessons.

## Process

### 1. Locate the active transcript

The parent identifies the active Claude Code project directory under the current profile's `projects/` using the session id, working directory, and matching transcript metadata. Read only the active conversation and its child transcripts. Do not search unrelated project directories. If the exact transcript cannot be resolved, write a concise digest of the active session instead.

Match a candidate by its recorded session id, working directory, and opening user prompt, never just its UUID or modification time. Claude Code stores main session JSONL and may store child transcripts under `<session-id>/subagents/`; inspect the actual layout instead of assuming message fields.

### 2. Independent reviews

Execute the three independent review assignments using the selected executor. Resolve the transcript and supporting templates before assigning them. Missing reviewer results remain gaps rather than agreement.

Use one independent reviewer each for judgment, tooling, and divergent analysis, reading `references/judgment-reviewer.md`, `references/tooling-reviewer.md`, and `references/divergent-reviewer.md` respectively. Reviewers inspect and report only.

Pass each template with the transcript path or digest substituted where marked. Reviewers return findings through the selected executor's normal result channel.

### 3. Synthesize

Assign one independent synthesis stage the resolved `references/synthesizer.md`, every reviewer's full output, and explicit gaps. It inspects and reports only, including citation checks permitted by existing access. The run ends with the proposed Accepted/Rejected/Backlog report before any approval-dependent edit stage.

### 4. Structural enforcement check

Sanity-check the synthesizer's Accepted list. For any item that would be enforced more reliably by a lint rule, script, metadata flag, or runtime check, move it from Accepted to Backlog. See the **principle-encode-lessons-in-structure** principle skill.

### 5. Apply

Before applying any Accepted edit, present the synthesizer's full Accepted/Rejected/Backlog output to the user and wait for explicit approval. The user picks which subset to apply and may redirect routings. Skill changes affect future sessions using that profile or project. Do not auto-apply.

Include backlog items in the report. Filing tickets or messages requires explicit approval for that external action; do not file them automatically.

For each approved Accepted item, follow the Routing field exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): parent does directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): use the bundled **author-skill** skill. Draft the edit, validate it with author-skill's behavioral and metadata checks (its steps 6 and 7), and revise until those checks pass.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to `author-skill` for description tuning. Rewrite the description so it front-loads the missed trigger, then check it against the missed prompt and a prompt that should not trigger it.
- `new skill via author-skill: <kebab-name>`: hand creation to `author-skill`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done. Skip this step if it doesn't.

### 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog proposed, or filed with explicit approval: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
