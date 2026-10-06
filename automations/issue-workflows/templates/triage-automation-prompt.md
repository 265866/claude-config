# Triage run prompt

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

The coordinator is the only authorized external writer. Delegated workers get narrow findings-only scopes, no Slack credentials, and an explicit prohibition on `SendSlackMessage`, `PostToSlack`, `chat.postMessage`, all other Slack writes, tracker writes, pushes, and pull-request writes. Resolve `<profile>/references/execution.md` from the same profile root and select execution by the evidence work: one report usually fits direct work or small delegation, while a substantial independent evidence batch can use native Workflow. Delegates use an existing `general-purpose` or `engineer` agent and inherit the configured model and effort. The harness must actually enforce tool/credential isolation; instructions or worktree isolation alone do not establish it. If isolation is uncertain, keep the work in the coordinator. Reconcile returned findings, including missing or failed results, before preparing the verdict. End a native run before a missing approval, then let the coordinator perform only the separately authorized external actions.

Use the absolute path to `<profile>/skills/triage-issue-reports/SKILL.md` as the operational skill.

The operational skill owns classification, attachment review, cause tracing, routing, dedupe, authorized tracker writes, compensation, and the final verdict. Post no progress messages. Preflight the source parent before a tracker write and immediately before an authorized verdict reply.

Prepare one substantive verdict ending with exactly one configured whole-line marker:

```text
[triage:bug]
[triage:performance]
[triage:other]
```

A bug or performance marker may append `tracker=<absolute-URL>`. The markers, author identity, and immutable thread coordinates must agree with configuration. Authorize both the tracker change and exact compensation operation before creating an issue; compensate if the authorized source-thread handoff fails, and verify compensation. If a required capability or approval is absent, return the prepared result without writes.
