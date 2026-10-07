---
name: interrogate
description: "Use for \"interrogate\", \"adversarial review\", \"multi-reviewer review\", \"challenge this\", \"stress test this code\", \"find blind spots\", or \"tear this apart\". Independent fresh-context reviewers challenge changes from complementary angles."
---

# Interrogate

Assign three independent fresh-context reviewers by default, each with a different primary focus. Every reviewer still gets the full prompt and rubric; the focus adds depth and does not replace complete coverage. Reviewers inherit the same model, so the focus split is what keeps them from finding the same things. Do not claim model diversity.

| Reviewer | Primary focus |
|----------|---------------|
| A | Correctness and failure modes: edge cases, error paths, concurrency, data loss, security. |
| B | Contracts and blast radius: callers, public interfaces, persisted data, platform and environment differences, compatibility. |
| C | Design and simplicity: unnecessary code or abstraction, reader load, and whether the tests prove the behavior. |

Add a reviewer with its own focus only when the change has a distinct risk the three do not cover, such as performance or UI behavior.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). Reviewers perform their assigned review without restarting routing or launching the enclosing review procedure.

The deliverable is a synthesized verdict. The review itself applies no changes. When the coordinator runs it as a stage of an authorized implementation task (not when the user's latest message requests only the review), the coordinator then fixes every Act On finding and every proven defect in any bucket that CLAUDE.md (Authorization and ownership) puts in scope, and reports the rest.

## Step 1, Determine Scope

Identify what to review from context:

- If the user points at specific files or a diff, use that
- If on a feature branch, run `git diff main...HEAD` (or the appropriate base branch) for the full changeset
- If the user's message references recent work, gather the relevant files

Package the diff (or file contents) plus any surrounding context files the reviewers need to understand the code.

## Step 2, State the Intent

Before spawning reviewers, state the intent explicitly. Derive this from:

- The user's message
- Commit messages
- PR description if one exists
- The code itself

Write one clear paragraph. Ask the user only when evidence cannot settle the intent and the wrong intent would change the verdict.

## Step 3, Independent Reviews

Execute the review assignments using the selected executor. Resolve the supporting templates and evidence paths, keep the review read-only, and retain a result for every required reviewer. Missing reviews stay explicit gaps rather than agreement.

Each reviewer prompt forbids edits and requires every finding, including low-severity and uncertain ones, tagged with severity and confidence. Do not open a PR or modify configuration to make a different review model available.

Read `references/reviewer-prompt.md` and fill in the template with:
1. The stated intent
2. The diff or file contents
3. The review rubric from `references/rubric.md`
4. The code-quality lens from `references/code-quality-review.md`
5. That reviewer's primary focus from the table above
6. The exact revision or base...head range under review, or `working tree on <HEAD sha>` for uncommitted work

Apart from the focus, every reviewer gets the same filled template, so every reviewer applies the full rubric and the code-quality lens.

## Step 4, Synthesize

As results come back, build a unified picture:

1. **Parse all findings** from the reviewers
2. **Identify consensus**. Findings raised by 2+ reviewers independently are highest signal.
3. **Identify lone-reviewer findings**. Still worth reading, but weight accordingly.
4. **Deduplicate**. Different reviewers may describe the same issue differently. Merge these and note which reviewers raised it.
5. **Note disagreements**. If one reviewer flags something and another explicitly says the opposite, that's useful context for the verdict.

## Step 5, Lead Judgment

You are the lead reviewer, a pragmatic senior engineer, not a neutral aggregator.

Read `references/lead-judgment.md` for the full framework.

Categorize every finding using these buckets:

- **Act on**. Real issues affecting correctness, security, or maintainability given the actual goals. These would block a real PR.
- **Consider**. Tradeoffs or preferences that are not proven defects, where you're not sure they outweigh the cost of addressing them right now. Worth the user's attention.
- **Noted**. Valid observations that are not defects. Context-dependent, premature optimization, or low-impact given the current stage.
- **Dismissed**. Wrong, nitpicky, or missing context. Brief explanation why.

For each finding, include:
- Which reviewer(s) raised it
- The category (act on / consider / noted / dismissed)
- A one-line rationale for the categorization

## Output Format

Present the verdict in this structure:

### Intent
> [The stated intent paragraph from Step 2]

### Reviewers
- Reviewer [label]: [reviewer label and focus], [N findings] (one bullet per reviewer)

### Act On
[Findings that should be addressed. For each: description, which reviewers raised it, why it matters.]

### Consider
[Findings worth thinking about. For each: description, which reviewers raised it, tradeoff involved.]

### Noted
[Valid but low-priority. Brief list.]

### Dismissed
[Rejected findings with brief rationale.]

### Agreement Map
[Where did reviewers agree, where did they diverge, and what does the pattern of agreement/disagreement tell us?]
