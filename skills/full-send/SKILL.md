---
name: full-send
description: Use when Colton gives "full send" or "full stop" as the instruction for a task, not as emphasis or a request to halt. Takes the work from its current state through proof, review, a PR, and babysitting while he is not watching. Full send then lands, deploys, and cleans up; full stop stops at merge-ready PRs and never merges.
---

# Full send

Colton is not watching this thread. He reads only the final report, or a question you ask through the question tool. Own the work from its current state to the end state of the mode he named.

- **Full send** ends with the PRs landed, the deploy verified where the repository deploys, and the task's branches cleaned up.
- **Full stop** ends with the task's PRs merge-ready. Never merge a PR, never deploy, and keep the branches.

What each phrase approves is in CLAUDE.md (Authorization and ownership). Act only within it. When the PR would target a repository Colton does not own, run full stop, and ask before every ask-first action, opening the PR included. Act on a phrase only when his own message gives it as the instruction for this task, or when your brief relays it from him.

In the main T3 conversation, review rounds run through [review-loop](${CLAUDE_SKILL_DIR}/../review-loop/SKILL.md)'s delegated reviewer, waits between babysit runs use Babysit's T3 standby, questions use AskUserQuestion, and each PR is linked as Opening a PR says. A delegated T3 task or other worker runs only the steps its brief assigns and returns its questions, and any PRs to stand by on, to the main conversation, as the T3 Code section of [the execution reference](${CLAUDE_SKILL_DIR}/../../references/execution.md#t3-code) says.

## Steps

1. **Finish the change.** Make the smallest change that meets the goal. Create a task branch when you are on the default branch. Before filing, ask one fresh subagent whether a simpler change reaches the same result, and take the simpler path when it holds up.
2. **Prove it.** Get the proof described below for every change in the diff.
3. **Review it** with review-loop on the diff, and fix what it finds.
4. **File the PR** with [Opening a PR](${CLAUDE_SKILL_DIR}/../../playbooks/opening-a-pr.md).
5. **Babysit it** in `drive` mode with [Babysit](${CLAUDE_SKILL_DIR}/../../playbooks/babysit.md) until each PR is merge-ready. Fix real findings and CI failures, and prove each fix before you push it.
6. **Full send only.** Land the PRs through [Shipping](${CLAUDE_SKILL_DIR}/../../playbooks/shipping.md) one at a time, applying the deploy rules below before and after each landing, then clean up as described below. Full stop skips this step.
7. **Report** as described below.

Keep going from step 1 to the end state. Ending the turn while checks or bots are pending stops the work unless something will wake the thread, which in T3 Code is Babysit's T3 standby.

## Proof

Proof is evidence you observed in this session. Use the most direct kind the change allows.

- Reproduce the original failure, apply the fix, and watch the same reproduction pass.
- Run the checks the repository's CI runs, as [rules/toolchains.md](${CLAUDE_SKILL_DIR}/../../rules/toolchains.md) describes.
- Add one focused test that fails without the fix when the repository has tests and none covers the behavior.
- For UI or runtime behavior, use the real surface through control-ui or control-cli. Green mocked tests do not prove what the user sees.

When nothing within reach can prove a change, ask as described below.

## Deploy and clean up (full send)

Read how the repository deploys and releases before landing. When landing or the deploy after it would rewrite persisted data, publish a release, or deploy to a shared or third-party target, ask before landing. When landing triggers a deploy to Colton's own machines, let it run, then check the service's health, its logs, and the changed behavior itself before the next PR lands. When the repository documents a manual deploy to his own machines, run it with a backup or rollback path first and a health check after. When the deploy breaks the service, open a revert PR, land and deploy it the same way, verify the service again, land no further PR, and report the failed deploy and the revert.

Then fetch. For each PR that `gh pr view` shows merged at the head you pushed, clean up its branch in this order.

1. When this session runs in the main checkout and that checkout holds the branch, switch it to the default branch and fast-forward it.
2. When this session runs in the task's own worktree and that worktree holds the branch, detach it at `origin/<default>` and leave the worktree for Colton.
3. Remove the task's other worktrees that hold the branch, as [worktree cleanup](${CLAUDE_SKILL_DIR}/../../playbooks/worktree-cleanup.md) says.
4. Delete the branch on the remote unless an open PR still targets it. Delete it locally with `git branch -D` only when its tip is that head, because a squash merge leaves it unmerged in local history.

Leave the branches of PRs that did not land, and any checkout that holds other work, as they are. Name every branch and worktree you left in the report.

## Asking

Ask only when you cannot continue alone:

- You cannot prove a change.
- A gate cannot pass and you cannot fix it.
- The next step needs an action the phrase does not approve.
- The goal is ambiguous in a way that changes the result.
- Another PR makes this one obsolete.
- A finding or choice needs Colton's decision, such as a product or preference decision, or one that review-loop, Babysit, or review-bot triage sends to him.

Ask the way CLAUDE.md says, with the PR link, what blocks you, and your recommended option first. Decide everything else with sensible defaults and list those decisions in the report. When no question tool is available, or no answer comes, take the safe path. Do not open, merge, or deploy anything the answer would decide, leave any open PR unmerged, and put the question first in your final message.

## Report

In plain language, give each PR link, each merge commit and the deploy result for full send, how you proved the change, the review rounds and the reviewer model, each decision you made for Colton, what you did not check, anything found outside the diff, and any open question first.
