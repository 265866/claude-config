---
name: why
description: "Investigate design rationale, historical constraints, regressions, postmortems, or data-backed thresholds using relevant authorized evidence. Return cited findings separated from inference and unknowns. Use how for runtime behavior."
---

# Why

Investigate the motivation and intent behind code.

Companion to the `how` skill. `how` answers what the code does and how it works. `why` answers what forces led to its shape.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). Use relevant evidence within the requested scope. Assigned investigators and synthesizers perform their stages without restarting routing, expanding authorization, or launching the enclosing procedure.

## Operating Posture

Operate as a **careful, cautious, and precise investigator**. Be honest about what you know vs what you're inferring. Read `references/epistemics.md` for the full confidence framework and phrasing guide. The synthesizer must follow it.

## Step 1. Understand the Target and the Question

Parse what the user is asking. The **target** is usually a chunk of code, a pattern, a feature, or a named design decision. The **question** is usually a design rationale, a tradeoff, a motivating edge case, an external constraint, dead code, or a broad history sweep.

If the target is vague ("why do we do it this way?" with no clear referent), make your best guess from conversation context (open files, recent edits, what was just discussed). State your interpretation briefly so the user can redirect if you're off, then proceed.

## Step 2. Establish the Code Anchor

Anchor the investigation in the relevant code and supplied context before selecting additional sources. Collect the following where applicable, and record missing history rather than inventing it:

- The relevant file path(s) and line range(s)
- The key symbols (function names, class names, constants)
- An initial commit list. The last few commits touching the target.
- PR numbers from merge commits (pattern `(#1234)` in the subject line)

Build this inline.

```bash
# Blame target lines for last-touch commits
git blame -L <start>,<end> <file>

# Start with bounded file history and expand if rationale remains missing
git log --follow -20 -p -- <file>

# Last N commits touching the file, PR numbers visible
git log --oneline -20 -- <file>

# Extract PR numbers from a commit message
git log -1 --format=%B <commit>
```

Pull PR bodies and discussion via `gh` for any substantive commits:

```bash
gh pr view <number> --json title,body,author,createdAt,mergedAt,labels,closingIssuesReferences,comments,reviews
```

Capture this as seed context (file paths, symbols, commits, PR numbers, linked ticket IDs). Pass it to the investigators.

## Step 3. Select and investigate relevant sources

Start with the code anchor and the nearest available rationale: a substantive commit, PR discussion, comment explaining an external constraint, or the source supplied by the user. A narrow question can be answered directly when that evidence establishes the answer. Do not search every category merely because a connector exists.

Use the session tool inventory to discover sources needed by the question. Local git history is available in a git workspace; use authenticated read-only `gh` only with existing access. Do not connect a private service. Private SaaS or API actions require the user's explicit authorization for that action.

Select sources according to the missing evidence:

| Question or missing evidence | Useful source category |
|---|---|
| Implementation-time rationale or review tradeoff | Source control history and PRs |
| Product or business forcing function | Issue / ticket tracker |
| Proposed design or documented decision | Long-form documents |
| Deliberation absent from the written decision | Real-time team chat |
| Runtime conditions, timeouts, reliability, or capacity | Infrastructure observability |
| Exceptions motivating defensive or corrective code | Error / exception tracking |
| Experiments, thresholds, migrations, or data reality | Product analytics warehouse |

Expand when the requested scope requires it, the nearest evidence is incomplete, or findings conflict. For a broad postmortem or history request, declare a source-coverage manifest and account for every selected category. Record unavailable relevant sources as gaps and empty searches as results. Sources outside the question's scope need no obligatory search or seven-category disclaimer.

For substantial independent source work, assign one bounded investigator per selected source using the coordinator's executor. Each gets the resolved `references/investigator-prompt.md`, the matching playbook from `references/source-playbook.md`, the code anchor, the question, and the source/time/query limits. Add `references/sources/incident-postmortem.md` when incident evidence is relevant. Investigators inspect and report only; cross-source leads return to the coordinator rather than silently broadening their assignments.

For small work, apply the same evidence discipline directly. Selectors and playbooks are aids to relevant investigation, not a mandatory roster.

## Step 4. Synthesize

Synthesize directly for a narrow investigation, or use a separate read-only synthesis stage through the selected executor when combining substantial source findings.

The synthesizer gets:
1. The findings, null results, declared source scope, and relevant coverage gaps
2. The code anchor from Step 2 (file paths, symbols, commit hashes, PR numbers, ticket IDs)
3. The user's original question
4. The epistemics framework from `references/epistemics.md`
5. The synthesizer prompt template from `references/synthesizer-prompt.md`

## Step 5. Present

Take the synthesizer's output and present it to the user. You may lightly edit for clarity or add context from the conversation, but **do not rewrite the confidence language**.

## Output Format

Use `references/synthesizer-prompt.md` proportionately: separate evidence, inference, competing hypotheses, and unknowns, with citations and a Sources Consulted record of actual searches. Include relevant selected sources that returned nothing or were unavailable. A narrow answer need not print every section or enumerate unrelated categories.

After the Sources Consulted block, if the user's `why` question is a precursor to actually changing this code, convert the lineage findings into a Preserve / Change / Avoid / Risk constraint set suitable for planning the change.

## Common Failure Modes to Avoid

- **Recency bias**. Assuming the most recent commit is authoritative. The current shape is often the accretion of many earlier decisions. Trace back.

## Reference Files

- `references/epistemics.md`. Confidence tiers and phrasing guide. The synthesizer must follow it.
- `references/investigator-prompt.md`. Base prompt template for investigator subagents.
- `references/source-playbook.md`. Index pointing at the category playbooks below.
- `references/sources/*.md`. One self-contained example playbook per category, plus cross-cutting `incident-postmortem.md`. Give an investigator the single file that matches its category and adapt it to the available MCP.
- `references/synthesizer-prompt.md`. Prompt template for the synthesizer subagent, including the output format.
