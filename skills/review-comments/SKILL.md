---
name: review-comments
description: Review scoped comments and suppressions with an independent comment-reviewer, apply justified deletions, fix accepted code findings, and encode real constraints.
---

# Review comments

Use the caller's files or diff. Otherwise use the current diff against the actual base branch, including staged and unstaged work. Changes outside that scope remain out of scope.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). Preserve an independent `comment-reviewer` role and its comment-only contract under either executor. The reviewer completes that assigned stage without restarting routing or implementing application-code fixes.

1. Resolve the scoped diff and current file snapshots. Assign the independent `comment-reviewer` role using the selected executor and isolated output. Pass the exact base, files, snapshots, and resolved profile paths. A worktree starts from its commit, so materialize the supplied current snapshots before review when the parent has uncommitted changes. This is scope preparation, not an independent application-code edit. Outside a git repository, use a dedicated copy of the scoped files and ask for a patch.
2. Inspect the final report and comment-only diff. Reject application-code edits, scope escapes, protected deletions, or unsupported CODE_CHANGE_REQUIRED flags. Spot-check nearby code and the cited rule. Use how or why on the exact symbol when a claimed constraint is ambiguous. Preserve an unresolved contract or suppression and report the required proof instead of deleting information because its proof is missing. Retry one rejected report with the concrete failure; a second rejection stays open and fails this workflow.
3. Apply accepted comment changes to the parent's current files, preserving other workers' edits. Fix accepted code findings that are proven defects in scope when implementation is authorized. A question or review-only request ends with the report. If the accepted set needs a design, use architect for a sketch, then implement the chosen shape only within the authorized scope. Materially different architecture, as CLAUDE.md defines it, requires the user's choice.
4. Remove obsolete paths and implement the smallest root-cause fix in scope. Run the narrowest behavior check, relevant edge or regression case, and configured formatting, type, build, and lint checks. Do not trade a needed correctness suppression for a failing build; fix its cause or keep the unresolved item visible.
5. For real constraints, offer the cheapest in-scope type, runtime check, test, or lint rule that can enforce them. Encode when implementation is authorized, then remove only the explanation that the code now expresses. Preserve license text, public API documentation, and irreducible external constraints. Actions behind the approval gates in CLAUDE.md (Authorization and ownership) still require explicit action approval.
6. Return deletion count, touched files, rejected or restored changes, code fixes and evidence, encoded constraints, unresolved constraints, and other open work through the selected executor's result channel.
