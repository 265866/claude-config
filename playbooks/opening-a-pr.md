### Opening a PR

Prepare a small, reviewable change and publish it only when the user explicitly requests or approves PR creation. Finishing a local task does not automatically create a PR.

1. Inspect the working tree, applicable repository instructions, existing commit style, changed behavior and relevant check output. Separate unrelated user edits without discarding them.
2. Apply clean-code and review-comments. Complete the relevant repository gates and the independent review required for a non-trivial change. Fix real findings and re-check their affected area.
3. Prepare new commits from working-tree changes as coherent units with the **commit-agent** agent; rewrite existing commits when it gives a clearer history, but rewrite only unpushed commits, or commits on a branch you created that nobody else has pushed to. Use conventional commits when repository history does not establish another style. Never invoke an editor or pager.
4. Prefer several narrow PRs to one large one. A stack is a base-branch chain: the root PR targets trunk, and each child branch starts from its parent's exact tip with its PR targeting the parent branch (`gh pr create --base <parent-branch>`, or `gh pr edit <pr> --base <parent-branch>` for an existing child). Branch from trunk only for independent work.
5. Title the PR in the repository's established style. Without one, use `type(scope): subject`, where the subject says how things behave after the change, in plain lowercase words, about ten words or fewer, with no trailing period. For example, `fix(web): sidebar drag and drop no longer snaps back`.
6. Write the description the way a careful engineer writes to a teammate who missed the conversation. Use the repository's PR template when it has one. Otherwise, write short plain paragraphs with no headings and no bold labels.
   - Open with the problem as a user or maintainer saw it, in one or two sentences. Never start with "This PR".
   - If the cause isn't obvious from the symptom, explain it next.
   - Say what works differently now. Name a file or symbol only when a reviewer needs it to follow the change. Use one short list when the change has several parts.
   - If a reviewer might worry about something, say what stays the same. Say what you left out on purpose, and why.
   - Say how you checked it, with what each check showed. For a bug fix, say whether the new test fails without the fix. Name anything you didn't check.
   - For a performance change, lead with the one number that matters, as before → after with its unit, and link the raw runs. For a UI change, add before and after screenshots.
   - Link related PRs and issues and say how they relate, such as "Fixes #12" or "Replaces #9, which only hid the error".

   Let the length follow the change. A small fix needs a few sentences, and every paragraph answers one question a reviewer would ask. Do not add SHAs, rebase history, file-by-file lists, reviewer lane recitals, or verdicts like "CLEAN". Link an artifact for detail. Use technical-writing and edit-prose. Never add agent coauthor trailers, generated-by lines, session links, or branding.

   A short body reads like this:

   > Dragging a thread in the sidebar snapped it back to where it started whenever the list held an archived thread.
   >
   > Archived rows have no order key, so the drop tried to place the thread next to a row it couldn't save, and the whole write failed. Now the drop skips rows that can't store a key and orders the rest.
   >
   > Pinned threads still sort the same way.
   >
   > I added a test that drags past an archived row. It fails without the fix. I checked the web app by hand, but not desktop.
7. Confirm the requested repository, base, branch and ready/draft state. Write the exact multiline body to a temporary file and use `gh pr create --base <base> --head <branch> --title <title> --body-file <body-file>`. Add `--draft` only when requested or when the owning workflow explicitly calls for a draft. Do not pass flags for an unsupported forge client.
8. Push the branch when the task created it. Pushing to a default or protected branch, to a shared branch the task did not create, or to a branch someone else owns asks first. Prepare the exact PR command and the reviewable result, and ask before creating the PR unless the user already requested or approved it. Run only the approved command, then inspect the actual result with `gh pr view`.
9. Return the real PR URL and check status. Starting an observation loop, posting a review reply, merging or deploying is a separate action with its own scope.

**Reply.** Concrete problem and behavior, local commits/head, verification and limitations, then the actual PR link or prepared action awaiting approval.
