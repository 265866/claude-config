# Incident & Postmortem Context

Not a separate source, a **cross-cutting angle**. When incident evidence is relevant to defensive code, use these query ideas within the assigned authorized source and time window. This reference does not require every available source or authorize cross-source searches:

- **Notion**: search for postmortems mentioning the target file, feature, or error string
- **Linear**: look for tickets labeled `incident`, `sev-*`, `postmortem-action-item`, `reliability`
- **Slack**: search `#sev-*` and `#incident-*` channels around the dates the target code was added
- **Git**: commits with messages like "fix for incident", "add defensive check", "revert" followed by "re-apply with..." are strong signals
- **Datadog**: existing incident records found through the discovered read-only interface (timelines need a separately verified path; see `datadog.md`), plus dashboards and monitors created as postmortem action items
- **Sentry**: issues whose first-seen/last-seen window aligns with the target's PR ship date, stack traces through the target
- **Databricks**: product-analytics events that classify an error condition (client-reported failures, user-visible retry events, etc.) often spike during an incident window. A drop in that event count after the target PR ships is circumstantial support that the target code resolved the user-visible symptom, even when Datadog/Sentry signal is noisy.

Read a relevant incident record fully when it is within the assignment. Return links into other sources as leads for the coordinator. Postmortem action items can connect an incident to code changes. Independent source evidence that converges on the same event strengthens the explanation; copied references alone do not establish independent corroboration.

Worth spending time on when the code's defensive character makes an incident-driven origin plausible. Skip it for code that doesn't look defensive.
