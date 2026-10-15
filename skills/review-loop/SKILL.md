---
name: review-loop
description: Use when Colton says "review loop", or asks to keep reviewing a change until a reviewer approves it. A fresh reviewer on a different model checks the diff each round, for at most 5 rounds, with a decision log so settled points stay settled.
---

# Review loop

You own the change. A fresh reviewer checks it each round. Fix what holds up, push back with evidence on what does not, and stop when the reviewer approves or the budget ends. The goal is the smallest change that meets the intent. Review makes the change correct, not bigger.

This loop is the iterative review. For a one-pass review from several angles, use [interrogate](${CLAUDE_SKILL_DIR}/../interrogate/SKILL.md).

## Budget

- At most 5 rounds, unless Colton names another cap in the request. Round 1 reviews the whole diff. Later rounds review only what changed since the last round and the findings still open.
- Stop early when a round returns only nits. Declined nits and comment, doc, or format-only fixes need no new round.
- One reviewer per round. The reviewer must not start subagents or reviewers of its own.

## Decision log

Reviewers tend to offer something that sounds helpful even when the point is borderline or wrong, and a fresh reviewer will reverse the last one's advice just as readily. The log stops that back-and-forth.

- Keep one log for the whole loop. Each entry has an id (D1, D2, ...), the round, `file:line`, the finding, its severity (`blocker`, `should`, or `nit`), the decision (`fixed`, `declined`, or `disputed`), and the evidence behind the decision.
- Send the full log with every round. A decided item stays decided. The reviewer may reopen it only with evidence the log does not already hold, such as a failing command, a reproduction, or a cited contract. Restating the argument or preferring the other option is not new evidence.
- Before acting on a finding, check it against the log. When it reverses an earlier decision without new evidence, record it as `rejected: reverses D<n>` and leave the code alone.
- Weigh a finding by its evidence, not the reviewer's confidence. A finding you cannot reproduce or tie to a concrete failure is a nit at most.
- When an item stays disputed after two exchanges, stop arguing it. It goes to Colton with both sides in two or three lines each.

## 1. Scope

Run `git status --short`. Review only the change's paths. Do not stash, discard, or include unrelated work. The base is the PR's base, or `git merge-base origin/<default branch> HEAD` after `git fetch origin`.

Findings about code the diff does not touch go on a "noted, not fixed" list for the report. Do not fix them in this loop.

## 2. Pick the reviewer

- In T3 Code, call `orchestrator_capabilities` and pick a model that did not write the change. Prefer a non-Claude model when one can run a child task. Otherwise use the strongest other Claude model it lists. If Colton names a model, use it or report that it is unavailable. Never substitute a different one silently.
- Start each round with `delegate_task`, using `role: "review"` and `mode: "async"`. Use a new `clientRequestId` per round, and reuse it only when retrying that same round. The task prompt is the whole brief, because the child gets no history. Save each round's `taskId`. Do not continue a review by sending to its `childThreadId`.
- After delegating, do independent work or end the turn. The completion notice wakes you. Do not poll. Call `task_status` only when you need the result mid-turn.
- Outside T3, or when T3 cannot start the child, use a fresh read-only general-purpose Agent. It runs on the session's model, so the report says so.
- Do not edit the scoped files while a review runs. A timeout, an error, or no reply is not approval. Cancel the task with `task_cancel`, confirm it stopped, and rerun the round with the log.

## 3. Round brief

Give the reviewer:

- One paragraph of intent, from the request, the commits, and the PR description.
- The base and head commits. In round 1, the whole diff. In later rounds, the diff since the last round and the open ids.
- The decision log and its rule that decided items stay decided.
- The rubric in [interrogate's rubric](${CLAUDE_SKILL_DIR}/../interrogate/references/rubric.md).
- The rules for the reply. Stay read-only. Report every finding with severity, confidence, `file:line`, and evidence. In later rounds, mark each open id `resolved` or `still open: <reason>`. End with `VERDICT: APPROVE` or `VERDICT: CHANGES`.

## 4. Act on findings

Check each finding against the code before changing anything. Fix the blockers and shoulds that hold up with the smallest change, and run the checks that cover each fix. Decline wrong findings with evidence. Fix a nit only when it is trivial and inside the diff. Update the log.

Do not push during the loop.

## 5. Next round

Start one only when budget remains and a blocker or should is still open, or when behavior code changed after the last approval.

## 6. Stop and report

- Approved means `VERDICT: APPROVE` on the current diff, no blocker or should open, and no doubt of your own left.
- Stuck means an item stayed disputed after two exchanges, or the budget ended. Running out of budget is not approval. Name the open ids.
- Commit the loop's fixes as one commit through the commit-agent agent. Push only when the request includes pushing or updating a PR.
- Report the rounds, the reviewer model as the tool reported it, what the loop changed, and the diff size before and after. Include the decision log in short form, the noted pre-existing issues, and anything still open.
- The verdict goes in the report to Colton, not in PR text. [Opening a PR](${CLAUDE_SKILL_DIR}/../../playbooks/opening-a-pr.md) keeps verdict lines out of PR prose.
