# Verify an existing fix

Use this mode when an open pull request or merged commit plausibly fixes the report.

Use the same externally supplied configuration, immutable source coordinates, trusted-identity checks, and action-authorization gates as the parent skill. This reference is not a separate grant to post or write. The existing artifact owns the fix. Verify it. Do not edit it, author a competing patch, or open another pull request.

## Qualify the artifact

Require one concrete artifact:

- An open pull request with code changes that address the symptom
- A merged pull request
- A merged commit with matching code and intent

A thread claim, tracker status, branch name, or cause hypothesis without a pull request or commit is not enough. If no artifact qualifies, leave verify mode: re-apply the parent skill's step 3 as if no artifact exists (a person's open pull request still counts as ownership), run any of steps 4 through 6 not yet run, then set operations status `Reproducing` and continue at step 7, or, when the switch came from step 14's pre-push re-check, set `Attempting bounded fix` and resume step 14 at the push, or otherwise, when step 9 already ran, set `Reproduced` and return to step 11.

When several artifacts exist, choose the one linked from the source thread or tracker. Otherwise choose the closest match to the affected code and state why.

## Protect the working tree

Use an isolated worktree, or a clean clone in the OS temporary directory; never the user's checkout. Before each bring-up, check out that build's revision detached in the checkout (for an open PR, fetch the host's pull request head ref, `refs/pull/<number>/head` on GitHub, inside that checkout), confirm `git rev-parse HEAD` matches it and `git status` shows no tracked or untracked changes, then pass the checkout as the adapter's repository input. When either check fails, use a fresh isolated worktree or clean clone at that revision for the build, and never clean, reset, or stash the old one.

Record:

- Baseline revision
- Patched revision
- Pull request or commit URL
- Build and environment inputs shared by both runs

Use the configured `repository.pull_request_url_format` public pull request link, not an API or app-internal URL. For a merged commit with no pull request, use its public commit page under `repository.url`.

## Measure the baseline

Give the baseline half and the patched half each the configured repro budget. When either runs out, the outcome is Inconclusive.

For an open pull request, use the merge base of its head and its base branch as the baseline, so both builds share a base, and record both SHAs.

For a merged fix, use the revision immediately before the fix when that revision builds and represents the old behavior; otherwise the outcome is Inconclusive, with the reason.

Through the configured control adapter:

1. Bring up the baseline app.
2. Confirm the correct app and environment.
3. Run the reported path through real UI actions.
4. Observe the discriminating symptom.
5. Reset and repeat it.
6. Capture baseline recording, screenshot, and state check.

If the symptom does not appear twice on the baseline, there is no baseline. Do not claim that the fix works.

## Measure the patched build

Build and run the pull request or fix commit with the same environment and data.

1. Run the same UI path.
2. Run it a second time from a reset state, for two runs in total.
3. Confirm that the broken state is gone.
4. Confirm the expected state appears.
5. Capture after recording, screenshot, and the same state check.

Do not stop at compilation or tests. The after result must come from a running patched app.

## Outcomes

### Confirmed

The baseline reproduces twice and the patched build resolves it twice.

- Mark operations status `Existing fix verified`.
- Link the artifact.
- Prepare one concise source-thread reply, obtain explicit authorization, and post only after the source preflight, if the run has not already posted its unprompted source reply.
- Include the before and after result.
- Open no pull request.

### Insufficient fix

The symptom appears on both baseline and patched builds.

- Mark operations status `Existing fix did not resolve it`.
- Link the artifact and say it did not resolve the symptom.
- Prepare the normal confirmed-repro source update if the run has not already used it; post only after explicit authorization and the source preflight.
- Open no competing pull request.

### Inconclusive

The baseline does not reproduce, the patched app cannot run, or the evidence does not show the discriminating state.

- Do not claim success.
- Mark operations status `Existing fix inconclusive`.
- State which half could not be measured.
- Keep the result in the operations thread or run output.
- Post nothing in the source thread unless a direct question requires an answer.

## Cleanup

Stop both builds, remove temporary local profiles and captures the run created according to retention policy, without discarding user work. Remove each worktree or clean checkout this reference created (`git worktree remove`, never `--force`, for a worktree), only when `git status --ignored` shows no tracked or untracked changes and only regenerable ignored files; its revisions exist on the remote, so worktree-cleanup's merged-branch condition does not apply. Otherwise keep it and report its path. The parent skill's step 15 governs the step 12 fix worktree. Undo external account or fixture setup and repro writes this run made through the control adapter, and report it. Deleting any other external account or fixture needs explicit action authorization; report anything retained for that reason.
