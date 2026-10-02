### Opening a PR

Prepare a small, reviewable change and publish it only when the user explicitly requests or approves PR creation. Finishing a local task does not automatically create a PR.

1. Inspect the working tree, applicable repository instructions, existing commit style, changed behavior and relevant check output. Separate unrelated user edits without discarding them.
2. Apply clean-code and review-comments. Complete the relevant repository gates and the independent review required for a non-trivial change. Fix real findings and re-check their affected area.
3. Prepare new commits from working-tree changes as coherent units with the **commit-agent** agent; rewrite existing commits only when the user asked for history editing. Use conventional commits when repository history does not establish another style. Never invoke an editor or pager.
4. Write a description for a reviewer who has not seen the chat. Lead with the concrete trigger and resulting behavior, then include useful implementation choices, evidence and limitations. Preserve the repository's template. Use technical-writing and edit-prose. Never add agent coauthor trailers, generated-by signatures, session links or branding.
5. Confirm the requested repository, base, branch and ready/draft state. Write the exact multiline body to a temporary file and use `gh pr create --base <base> --head <branch> --title <title> --body-file <body-file>`. Add `--draft` only when requested or when the owning workflow explicitly calls for a draft. Do not pass flags for an unsupported forge client.
6. Prepare the exact push and PR commands and the reviewable result before requesting missing authorization. Explicit approval for one action does not grant the other. Execute only the approved commands, then inspect the actual result with `gh pr view`.
7. Return the real PR URL and check status. Starting an observation loop, posting a review reply, merging or deploying is a separate action with its own scope.

**Reply.** Concrete problem and behavior, local commits/head, verification and limitations, then the actual PR link or prepared action awaiting approval.
