# Datadog telemetry

## What this source may contain

An authorized Datadog connection may expose metrics, monitors, dashboards, logs, APM spans/traces, incident records, and notebooks. These provide runtime evidence around a code change. Availability, retention, sampling, schemas, and tool names depend on the connected deployment.

A metric or monitor's presence shows that someone measured or watched a condition. It does not establish why a particular code change was made. Pair telemetry with a commit, PR, incident note, or other direct decision record.

## Discover and search

Confirm the user's scope and discover the actual connected tool inventory, schemas, and read-only semantics before querying. Do not assume a tool exists because it appears in an older example. Read existing analyses freely. Starting a remote analysis creates something the team sees and may use quota. Under a read-only history investigation, offer it instead of starting it. Start one only when the user's request asks for it, with the coordinator owning the call, and report it. Do not write other records under a read-only history investigation.

1. **Owning service.** Discover actual service/entity ownership and dependencies. The current documented entity search is `search_datadog_entities`; use it only when present in the connection with the required read-only scope. Confirm entity kind, supported filters, and dependency information from its schema.
2. **Dashboards and monitors.** Search existing views and alert definitions for the feature, service, symbol, or error. Record their actual queries, units, thresholds, creation/history evidence, and relationship to the target. A matching threshold is supporting evidence; require a direct source before calling it the code author's reason.
3. **Metrics.** Discover the exact metric, then verify description, units, tags, aggregation, timezone, and historical coverage before reading its time series. Compare a relevant bounded window with the change date. Label the correlation as an inference and check neighboring changes.
4. **Logs.** Use observed service/tag/error filters and a bounded time range. Prefer compact pattern/count aggregation over raw rows when the connected interface supports it. Verify its actual query syntax and whether a requested pattern option exists. Limit output and protect private data.
5. **APM spans and traces.** Use the actual supported read-only span aggregation/search and trace retrieval for endpoint failures, slow paths, retries, or cross-service behavior. Confirm sampling and units before reporting counts or percentiles.
6. **Incidents.** Search existing incident records around the introduction of defensive code. `get_datadog_incident` does not include incident timeline data. Read an existing timeline only through a separate verified read-only path when available; otherwise report that evidence as missing. A timeline entry directly naming the change can support the rationale, but do not infer such an entry from summary details alone.
7. **Notebooks.** Read existing investigation notes only when exposed by the authorized interface. Return a gap when the suspected rationale is unavailable rather than writing a new notebook.

## Evidence and pitfalls

Useful evidence includes a documented monitor condition matching the code constraint, a source-linked dashboard explaining the subsystem, a verified metric trajectory, an incident note naming the code change, or an error pattern preceding it. Establish owner/date evidence rather than guessing it from a title.

Charts reflect their authors' framing. Instrumentation changes, sampling, renamed metrics, retention gaps, partial rollouts, and other commits can explain a trajectory. Zero results are not proof of no historical activity. Correlation and timing support a hypothesis; they do not prove causation or authorship.

## What to return

Return the observed item type, title/name, real link or identifier, known owner/date, exact bounded query or retrieved condition, compact evidence, and its relevance/strength. Cite the actual artifact, label inferences, and state unavailable timeline, retention, permissions, or tool access as a gap. Keep raw private logs and unrelated telemetry out of the reply.
