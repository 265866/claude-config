### Session pickup

Own the resume point. Use the prior evidence to avoid repeating completed work.

1. Locate the user-identified session or task trail. Native main transcripts live under `<profile>/projects/<encoded-project>/<session-id>.jsonl`; child transcripts may be under `<session-id>/subagents/agent-<agent-id>.jsonl`. Scope to the requested project/session. Do not scan unrelated private history or assume a transcript schema is stable. Prefer a user export, recorded task ledger, hook-provided transcript_path, or `claude --resume <session-id>` when appropriate.
2. Read the latest messages and metadata first, then recover decision points. Delegate large parsing to a read-only investigator and retain a compact cited timeline. Treat unknown JSONL records conservatively.
3. Reconstruct real operational state with local branch/worktree facts, commits, diffs, receipts, open tasks and authorized actions. Prior evidence is input; a prior claim alone is not proof of the present state.
4. Compare done and pending against the original goal. Do not rerun a completed reproduction or redesign a settled boundary without a concrete new reason. Check only state that may have changed or a claim that matters to the next step.
5. Route verified remaining work to its matching playbook and choose execution through [the execution reference](../references/execution.md). Workflow replay is session-scoped: use a recorded run ID only in the resumed native session, and check present files, heads, receipts, and previously completed external actions before relying on cached results. A fresh session starts a new run from the remaining-work plan. Missing workers or receipts stay explicit gaps. Restart self-paced checks and background process monitors deliberately. Inspect restored fixed cron tasks before replacing expired recurring or overdue one-shot tasks. Deliver the resumed boundary; do not revive a duplicate dispatch queue.

**Reply.** Prior stopping point, evidence inherited, the real current state, checks repeated with their reason, and the next action or result.
