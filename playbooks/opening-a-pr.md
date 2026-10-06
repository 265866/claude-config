### Opening a PR

Prepare a small, reviewable change and publish it only when the user explicitly requests or approves PR creation. Finishing a local task does not automatically create a PR.

1. Inspect the working tree, applicable repository instructions, existing commit style, changed behavior and relevant check output. Separate unrelated user edits without discarding them.
2. Apply clean-code and review-comments. Complete the relevant repository gates and the independent review required for a non-trivial change. Fix real findings and re-check their affected area.
3. Prepare new commits from working-tree changes as coherent units with the **commit-agent** agent; rewrite existing commits when it gives a clearer history, but rewrite only unpushed commits, or commits on a branch you created that nobody else has pushed to. Use conventional commits when repository history does not establish another style. Never invoke an editor or pager.
4. Prefer several narrow PRs to one large one. A stack is a base-branch chain: the root PR targets trunk, and each child branch starts from its parent's exact tip with its PR targeting the parent branch (`gh pr create --base <parent-branch>`, or `gh pr edit <pr> --base <parent-branch>` for an existing child). Branch from trunk only for independent work.
5. Title the PR in the repository's established style; without one, use Conventional Commits, `type(scope): subject`, with an imperative subject, no trailing period, and a real symbol when one carries the change, such as `fix(watch-pr): treat merge-queue wait as merge-ready`.
6. Write a description for a reviewer who has not seen the chat. Preserve the repository's template. Otherwise use these sections in order and drop any that have nothing to say:
   - `## Why`: the trigger, intent and approach in one or two short paragraphs.
   - `## Scope`: bullets naming real symbols and paths, both sides of a rename, and what is out of scope when the boundary matters.
   - `## Tradeoffs`: only rejected alternatives a reviewer would otherwise ask about.
   - `## Blast Radius`: one to three sentences on who or what the change touches and why it is safe or risky.
   - `## Verification`: each real check and its outcome; for a performance change, one primary number as `before → after` with its unit.

   Keep the body short enough that a squash commit made from it stays under about 40 lines. Do not add `## Summary` or `## Test plan` boilerplate, SHAs or rebase history, file-by-file checklists, reviewer lane recitals, or "CLEAN" verdicts; link an artifact for detail. Use technical-writing and edit-prose. Never add agent coauthor trailers, generated-by signatures, session links or branding.
7. Confirm the requested repository, base, branch and ready/draft state. Write the exact multiline body to a temporary file and use `gh pr create --base <base> --head <branch> --title <title> --body-file <body-file>`. Add `--draft` only when requested or when the owning workflow explicitly calls for a draft. Do not pass flags for an unsupported forge client.
8. Push the branch when the task created it. Pushing to a default, protected, or shared branch, or to a branch someone else owns, asks first. Prepare the exact PR command and the reviewable result, and ask before creating the PR unless the user already requested or approved it. Run only the approved command, then inspect the actual result with `gh pr view`.
9. Return the real PR URL and check status. Starting an observation loop, posting a review reply, merging or deploying is a separate action with its own scope.

**Reply.** Concrete problem and behavior, local commits/head, verification and limitations, then the actual PR link or prepared action awaiting approval.
