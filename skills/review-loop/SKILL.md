---
name: review-loop
description: Use when Colton says "review loop", or asks to keep reviewing a change until a reviewer approves it. A fresh reviewer, on a different model when one is available, checks the diff each round until a round finds no blocker or should, with a decision log so settled points stay settled and the scope stays put.
---

# Review loop

You own the change. A fresh reviewer checks it each round. Fix what holds up, push back with evidence on what does not, and stop when a round finds nothing left to fix. The goal is the smallest change that meets the intent.

This loop is the iterative review. For a one-pass review from several angles, use [interrogate](${CLAUDE_SKILL_DIR}/../interrogate/SKILL.md).

## Rounds

- No round cap, by Colton's choice, unless he names one in the request. The round budget in [the execution reference](${CLAUDE_SKILL_DIR}/../../references/execution.md) does not apply to this loop. The guards in this section and the decision log replace it.
- A rerun after a failed or cancelled round counts as a round. Round 1 reviews the whole change. Later rounds review what changed since the last round and the items still open.
- Hold the scope. Decline a finding that widens the change beyond its intent, such as a new feature, a refactor of code the change did not need to touch, or a restructuring that fixes no proven defect. Record it as `declined: scope`. A scope decline is not a dispute and does not go to Colton, even when the reviewer keeps contesting it. A finding in a "Never auto-dismiss" category is the exception (see the decision log).
- When the same lines have been edited in three rounds, other than light fixes, treat the fixes as going in circles. Stop editing them, keep the simplest version with no proven defect, and send the item to Colton as `disputed: to Colton`.
- After every fifth round, post a one-line status in a normal message (round number, the count of `open` items, and whether that count is falling) and keep going.
- A nit is a preference or style point, not a proven defect. Classify each finding yourself after checking it, whatever label the reviewer gave.
- `blocker` here is a finding severity, not a concrete blocker in CLAUDE.md's sense. It does not stop the loop. Handle it by this skill's rules, including the high-severity exception in the decision log.
- A light fix changes only comments, formatting, or docs outside the deliverable. A light fix alone does not start a new round, but a light fix to an `open` blocker or should still waits for the reviewer to confirm it (step 5). Instruction, prompt, and skill files count as the deliverable, not as docs.
- One reviewer per round. The reviewer must not start subagents or reviewers of its own.

## Decision log

Colton has seen reviewers offer a plausible suggestion even when the point is borderline or wrong, and a fresh reviewer reverse the last one's advice just as readily. The log stops that back-and-forth.

- Keep one log for the whole loop in a file in the OS temp directory, so it survives turn ends and compaction. It is separate from show-me-your-work's TSV log. Each entry has an id (D1, D2, ...), the round, `file:line`, the finding, its severity (`blocker`, `should`, or `nit`), a status (`open`, `resolved` once the reviewer confirms the fix, `declined`, or `with Colton` once it goes to him), the decision (`fixed`, `declined`, `disputed`, or `needs approval`), and checkable evidence for the decision, such as a command and its output, a reproduction, or a cited line.
- Send the full log with every round. A decided item stays decided. The reviewer may reopen it only with evidence the log does not already hold. Restating the argument or preferring the other option is not new evidence.
- Before acting on a finding, check it against the log. When it reverses an earlier decision without new evidence, record it as `declined: reverses D<n>` and leave the code alone. A finding in a "Never auto-dismiss" category goes to Colton under the next rule instead, unless he already decided that item.
- Weigh a finding by its evidence, not the reviewer's confidence. Some findings claim a defect, from the reviewer or from you. If the checks within reach cannot reproduce one or tie it to a concrete failure or cited source, it is not proven. Record it as `declined: unverified` and list it as unverified in the report. It does not hold the loop open. The exception is any finding in a category that [review-bot-triage](${CLAUDE_SKILL_DIR}/../../references/review-bot-triage.md) lists under "Never auto-dismiss". A finding the reviewer rated `blocker` counts as high-severity there. Whether you could not prove it or proved it wrong, record it as `disputed: to Colton` with any disproof attached, instead of declining it.
- When the reviewer still contests a declined item, other than a `declined: scope` item or one Colton already decided, after two rounds, and no check within reach settles it, stop arguing it. It goes to Colton with both sides in two or three lines each. The other open items keep going. When Colton answers an item and no review is running, apply his decision the way step 4 applies a fix, with its checks and a checkpoint commit. Then continue from step 5. A fix or an approved action makes the item `open` again for the reviewer to confirm. A refusal, or a decision against the finding, makes it `declined`. Update its decision to `fixed` or `declined` to match.

## 1. Scope

Run `git status --short`. Review only the change's paths. Do not stash, discard, or include unrelated work. When the change is uncommitted, commit it first through clean-code and the commit-agent agent, on a task branch if you are on the default branch, so every round has a fixed range.

The change is base..head. Use the range Colton names. Otherwise the base is `git merge-base origin/<PR base branch, else default branch> HEAD` after `git fetch origin`.

Proven defects in code outside base..head go on an "outside the diff" list for the report. Do not fix them unless one stops the change itself from working.

## 2. Pick the reviewer

- In T3 Code, call `orchestrator_capabilities` and pick a Claude model that did not write the change, preferring Fable or Opus, then Sonnet, then Haiku. If none is available, use the writer's model and say so in the report. Use a non-Claude model only when Colton asks for one. If Colton names a model, use it. If it is unavailable, report that and stop as Stuck before round 1. Never substitute a different model for one he named.
- Start each round with `delegate_task`, using `role: "review"`, `mode: "async"`, and `target: {providerInstanceId, model}` for the chosen model. Leave isolation at its shared default. Give each round a new `clientRequestId`, and reuse one only to retry a call whose response was lost. The task prompt is the whole brief, because the child gets no history. Save each round's `taskId`. Do not continue a review by sending to its `childThreadId`.
- After delegating, do independent work or end the turn. The completion notice wakes you. Do not poll. Call `task_status` only when you need the result mid-turn, or when you wake for something else and the review has run more than 30 minutes. A review with no result after 30 minutes counts as stalled, whether it is a T3 task still working or an Agent.
- Outside T3, or when `delegate_task` is unavailable, use a fresh read-only general-purpose Agent. Pass a different model through its `model` field when the schema lists one, in the order above. Otherwise it runs on the session's model, and the report says so. When Colton named a model the Agent cannot run, report that and stop as Stuck.
- Do not edit the scoped files while a review runs. An error, a stalled review, or a reply without a verdict is not approval. When it is still running, stop it (`task_cancel` in T3, `TaskStop` for an Agent) and confirm it stopped. No rerun, including the model switch below, runs past a cap Colton named. Reaching the cap makes the loop Stuck. Otherwise rerun the round, under a new `clientRequestId` in T3. When the rerun also fails, switch once to the next model in the order, or to the Agent fallback when none is left. When the switched reviewer also fails, or no switch is possible, stop as Stuck and report the failure. When Colton named the model, do not switch. Stop as Stuck after the failed rerun.

## 3. Round brief

Give the reviewer:

- One paragraph of intent, from the request, the commits, and the PR description.
- The ranges. In round 1, base..head. In later rounds, both base..head and the last reviewed commit..head, plus the open ids.
- The decision log and its rule that decided items stay decided.
- The absolute path of [interrogate's rubric](${CLAUDE_SKILL_DIR}/../interrogate/references/rubric.md), resolved before you send it.
- The rules for the reply. Stay read-only, and do not start subagents. Judge only lines in base..head, and label findings in other code `PRE-EXISTING`. Report every finding with severity (`blocker`, `should`, or `nit`), confidence, `file:line`, and evidence. In later rounds, mark each open id `resolved` or `still open: <reason>`. End with `VERDICT: APPROVE` when no blocker or should remains in base..head, otherwise `VERDICT: CHANGES`. A restructuring suggestion is a finding, not a reason to withhold approval.

## 4. Act on findings

Check each finding against the code before changing anything. Fix every proven defect in base..head, whatever its label, with the smallest change, and run the checks that cover each fix. Decline wrong findings with evidence. Fix a nit only when it is trivial and the round also has a blocker or should to fix. Otherwise list it in the report. Send a proven blocker or should to Colton with status `with Colton` when fixing it needs a product or preference decision that evidence cannot settle, access only Colton has, or an ask-first action. Record a decision he must make as `disputed: to Colton`. Record an action he must approve, or access only he has, as `needs approval`, with the exact command or the access needed. Update the log. Commit the round's fixes as one local checkpoint commit, which step 6 squashes. Do not push during the loop.

## 5. Next round

Unless a cap Colton named has ended or the reviewer kept failing, start the next round when a blocker or should is still `open`, or when anything other than a light fix changed after the last reviewed commit.

## 6. Stop and report

- Done means the last round returned `VERDICT: APPROVE` or only nits, declined, or outside-the-diff findings by your own check, nothing but light fixes changed after it, no blocker or should is `open`, and no item is `with Colton`.
- Stuck means Done does not hold and step 5 starts no round, for example because a cap Colton named ended, the reviewer kept failing, or only items `with Colton` remain. Reaching a cap is not approval. Name the `open` and `with Colton` ids.
- Have the commit-agent agent squash the loop's fix commits into one. Check that `git rev-parse HEAD^{tree}` is the same before and after the squash, and report both head commits. Push only when the request includes pushing or updating a PR.
- Report the rounds, the reviewer model as the tool reported it, what the loop changed, and the diff size before and after. Include the decision log in short form, the "outside the diff" list, and anything still open.
- The verdict goes in the report to Colton, not in PR text. [Opening a PR](${CLAUDE_SKILL_DIR}/../../playbooks/opening-a-pr.md) keeps verdict lines out of PR prose.
