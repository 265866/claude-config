---
name: how
description: "Use for \"how does X work\", code walkthroughs before changing something, and placement / ownership / layering questions (\"where should this live\", \"which package owns this\", \"is this the right layer\"). Explains subsystem architecture, runtime flow, onboarding mental models. Use why for motivation."
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). This investigation is read-only. Assigned explorers and explainers follow their stage contracts without restarting routing or launching another investigation.

## Step 1. Assess Complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): investigate and explain directly in one pass. Go to Step 2b.
- **Complex** (a broad question with genuinely independent subsystem slices): partition the investigation, then synthesize the findings. Go to Step 2a. Multiple files alone do not require this path.

When in doubt, take the simple path.

## Step 2a. Explore (complex questions only)

Decompose the question into a few distinct exploration angles. Record the required slices, then execute them using the selected executor. Each explorer gets the resolved `references/explorer-prompt.md`, the question, its angle, available evidence, and a read-only scope. Results must account for each required slice. Then go to Step 3.

## Step 2b. Direct Explain (simple questions)

Trace the relevant code directly and explain it using `references/explainer-prompt.md` without the explorer-findings section. Do not add a worker solely to relay a small answer. Go to Step 4.

## Step 3. Synthesize (complex questions only)

After the exploration stage resolves, synthesize using `references/explainer-prompt.md` with the question, the read-only scope, every result, and explicit gap. Use the selected executor when synthesis is a separate stage. Resolve contradictions by checking code; do not hide missing slices or restart the full investigation.

## Step 4. Present

Present the explainer's output to the user. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Output Format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
