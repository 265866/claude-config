# Reproduction run prompt

These run instructions require a user-configured external harness. Populate every placeholder before the run. Raw templates require explicit absolute paths; they do not expand skill-directory or shell-variable substitutions.

Required absolute paths:

- Operational skill: `{{OPERATIONAL_SKILL_ABSOLUTE_PATH}}`
- External configuration: `{{ISSUE_CONFIG_PATH}}`
- Bundled resource directory: `{{ISSUE_RESOURCE_ABSOLUTE_DIRECTORY}}`

Read the operational skill and external configuration before acting. The resource directory must be the resolved `<profile>/automations/issue-workflows`; resolve any reference or template name against that absolute directory. Unresolved placeholders, missing files, incomplete configuration, or unavailable required adapters stop the run without writes.

The harness must supply any existing explicit action authorizations separately, with their exact target and payload/command scope. No grant is implied by this template. Prepare the concrete verdict, ticket change, status update, or draft pull request before asking for its approval. In unattended runs without the specific grant, stop before the write and return exactly what needs approval. Never install a service, create an integration, activate a schedule, or copy credentials to a worker.

Trigger:

```json
{
  "source_channel_id": "{{SLACK_CHANNEL_ID}}",
  "ts": "{{SLACK_MESSAGE_TS}}",
  "thread_ts": "{{SLACK_THREAD_TS_OR_EMPTY}}"
}
```

The source is one report in the configured Slack channel. Freeze `SOURCE_CHANNEL_ID` from the trigger and `SOURCE_THREAD_TS` from nonempty `thread_ts`, otherwise `ts`. Require a configured-channel match, a nonempty root timestamp, an existing parent at those coordinates, and a stable source permalink. Never replace these values with reply or operations-thread coordinates. Never post a root message in the source channel or fall back to another channel.

The coordinator is the only authorized external writer. Delegated workers get narrow findings-only scopes, no Slack credentials, and an explicit prohibition on `SendSlackMessage`, `PostToSlack`, `chat.postMessage`, all other Slack writes, tracker writes, pushes, and pull-request writes. Resolve `<profile>/references/execution.md` from the same profile root and choose direct work, small delegation, or native dependent verification phases according to the evidence workload. Delegates use an existing `general-purpose` or `engineer` agent and inherit the configured model and effort. The harness must actually enforce tool/credential isolation; instructions or worktree isolation alone do not establish it. If isolation is uncertain, keep the work in the coordinator. The live app/control session and the single authorized fix stay under one owner; a workflow never adds concurrent UI owners or extra fix attempts. Reconcile returned findings, including missing or failed results. End a native run before a missing approval, then let the coordinator push the fix branch this run created and perform only the separately authorized external actions.

Use the absolute path to `<profile>/skills/reproduce-and-fix-issues/SKILL.md` as the operational skill. Supply the configured repository, default branch, tracker adapter, app-control adapter, completed absolute feature-map path, temporary artifact directory, and draft pull request capability in the external configuration.

Wait for exactly one configured whole-line triage marker from the configured stable identity as a reply in this exact channel and source thread. Proceed only for `[triage:bug]` or `[triage:performance]`; an untrusted author, mismatched coordinates, conflicting markers, `other`, or timeout ends the run silently. A trusted marker does not authorize Slack, tracker, or pull-request writes.

Require all real-app control capabilities and a completed map for the reported feature before attempting a repro. Reproduce the exact discriminating symptom twice through real UI interaction, with a reset between attempts and actual media review. Stop for missing mapping or control capabilities. Verify an existing pull request or commit without authoring over it, using baseline and patched UI paths twice each.

Honor fix ownership. Attempt at most one bounded root-cause fix after the confirmed-repro gate and rejection window. Before-and-after recordings, screenshots, state cross-checks, focused tests, and required repository checks must pass before preparing a draft pull request. Push the fix to the branch this run created without asking, and report it. Obtain explicit per-action approval before pull-request writes, tracker changes, or Slack updates. Never merge or deploy. Always clean up disposable resources the run created, and report any external cleanup requiring approval.
