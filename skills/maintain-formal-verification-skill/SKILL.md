---
name: maintain-formal-verification-skill
description: "Audit a project's formal verification against the code, or bring it back in line when maintenance is requested. Reads every commit that touched verified code since the sync commit, updates the model, harness, or properties from the code, reruns, and says whether each failure is drift in the verification or a bug in the code. Use for /maintain-formal-verification-skill, \"is the model still true to the code\", or after merges and refactors that touched verified code without rechecking it. Audits report proposed changes without edits; authorized maintenance edits the verification only."
---

# Maintain a formal verification skill

A formal check proves a property of what it describes. When the code changes and the verification does not, the check can keep passing while it describes code that no longer exists. That pass is the dangerous case, because it looks like a proof. This skill is the upkeep loop for a verify skill that the create-formal-verification-skill skill generated, or for any project-local skill that runs a model checker, prover, or code-level verifier against named code. The project-local skill handles a change that an agent makes while it uses that skill. This skill handles the changes that skipped it, such as merges, edits made without the skill, and drift that builds up across many commits. For a verification skill that drives the running app and keeps a feature map, use the maintain-verification-skill skill.

Choose the mode from the user's request before starting. An audit or a question, such as "is the model still true to the code", is read-only. It reports each check's outcome and the proposed model, harness, property, and skill changes without editing anything in the project. A request to update or maintain the verification authorizes edits within the edit scope below.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). Reading the commits for independent checks may be batched. Verifier runs and scratch breaks in the working tree have one owner. Assigned readers perform their stages without rerouting or launching another maintenance pass.

## Outcomes

Give each check one outcome, and say which:

- **in sync**: no change since the last sync alters what the check describes, and the check passes.
- **update needed**: an audit found that the code changed and the verification no longer describes it. Report the proposed change and the rerun result, if you ran it.
- **updated**: maintenance changed the verification so that it describes the new code, and the check passes.
- **bug**: the verification describes the current code, and the code breaks the property. This is a finding about the code. It is not drift.
- **blocked**: the check could not be brought back in line or could not run. Say exactly why.

A check can carry two outcomes. In maintenance, the update makes the verification describe the code again, and then the property fails on it. That check is both updated and bug. In an audit, the same case is both update needed and bug, but only after the proposed change ran. Until then the failure is a bug candidate.

## Edit scope

In maintenance mode, edit only the verification: models, harnesses, property files, and the verify skill itself. Audit mode edits nothing in the project. An audit may run the checks as they stand, and may run a proposed change or a scratch break in a copy in a temporary directory outside the project. Neither mode edits product code during a run, unless the user asks. The exception is maintenance mode's temporary scratch break, or cheap bug-confirming test, that step 5 runs and then removes. An audit always makes its break, and runs any bug-confirming test, only in its temporary copy outside the project. Verifier output, such as TLC's `states/` directory, goes to a temporary directory or is ignored output the verifier regenerates. When a property fails on the current code, do not weaken the property or the model to make it pass. Report the failure.

## Pass

1. **Find the checks.** A verify skill has no fixed name, so find it by what it does. It is a project skill that runs a model checker, a prover, or another verifier against named code, usually under `.claude/skills/verify-*/`. Read each one you find, or the one the user named. For each check, collect the property, the code it covers, the bounds and assumptions, the command that runs it, and the commit where it was last confirmed to describe the code. If no verify skill exists, stop and point at the create-formal-verification-skill skill. If the skill does not record a sync commit, use the last commit that changed the verification files, and say that you did.

2. **Run it as it is.** Run each check once before you change anything, and record the result. A pass here does not tell you that the code is correct. It tells you that the old description still holds. A failure here can be drift or a bug. Do not decide which until step 5.

3. **Read every change to covered code.** Diff the covered files from the sync commit to the current commit, and read each commit message. Also look for code that moved. A covered function that is renamed, split, or moved to another file is still covered code. Also look for new code that touches the state that a check guards, such as a new function that writes the same fields. For each change, decide which of these it is:
   - **No effect.** The change does not alter anything the verification describes, such as formatting, comments, or code paths that the verification does not cover. Check this against the model or harness, not against the commit message.
   - **The verification no longer describes the code.** A step that was one indivisible action is now two, a branch was added or removed, a check moved, a new path reaches the guarded state, or a value now has a different range. The model or harness must change.
   - **The promise changed on purpose.** The change alters what the code promises, and evidence in the change says that this is intended. That evidence can be the doc comment, the tests, the changelog, or the commit message. The property must change, and you must cite that evidence.
   - **The promise may be broken.** The code changed, and no evidence says that the promise changed. Treat a failure that follows as a bug candidate.

4. **Update from the code, not from the result.** Change the model or harness so that each changed part again points to code that a reviewer can open, and keep one indivisible step in the code as one step in the verification. Write the update from the code before you rerun, and do not shape it by what makes the check pass. Change a property only for a promise that changed on purpose. Write down the old wording, the new wording, and the evidence. Keep the bounds unless the change makes them wrong. If you must reduce a bound, say so in the report. An audit writes this update as a proposal in its temporary copy, not in the project.

5. **Rerun and judge each result.**
   - **Pass:** the check can now pass on a description that has lost the ability to fail. Break the new code the way the property guards against, such as removing a new check or reordering a new step, and confirm that the check catches it. Then drop the break. In maintenance mode, when the checkout has uncommitted work you do not own, make the break in a separate worktree or copy. An audit makes it only in its temporary copy outside the project.
   - **Fail:** replay the counterexample against the real code, step by step. If a step cannot happen in the code, the verification is wrong. Fix the verification, or propose the fix in an audit, and say what was wrong. If every step can happen, it is a bug. Name the commit that introduced it, tell the counterexample as a sequence of steps in the code's own words, and state the harm in one sentence. If a cheap test or reproduction against the real code shows the bug, add it to the report as evidence. Remove it once it has run, and do not commit it to the product code.

6. **Update the verify skill.** In maintenance mode, update the code that each check covers, the commands, the bounds, the assumptions, and the sync commit. Set the sync commit to the commit that you checked. Do not move the sync commit for a blocked check, and say so in the report. Then follow the verify skill once as the next agent would, so that you know its steps still run. An audit lists these skill changes as proposals and moves no sync commit.

## Report

Say which mode ran. Tell the user, for each check:

- the outcome, and the commits that you read;
- what changed in the verification, or what an audit proposes to change, with a short reason for each change, either that the code changed shape or that the promise changed on purpose (with the evidence);
- the rerun result, and the break that you used to show the updated check can still fail;
- each bug, in plain words, with the counterexample as steps in the code's words, the harm, and the commit that introduced it;
- what the verification still does not cover, including new code that it should cover and does not.

Say outright which failures were drift in the verification and which were bugs in the code. For a check that passed before the update and fails after, say that the old pass was on a stale description.

A model change is its own change. In maintenance mode, put the verification updates in a local change of their own, separate from any product fix. Opening a PR is an ask-first action (CLAUDE.md, Authorization and ownership). An audit stops at its findings, and its proposed changes do not authorize applying them.
