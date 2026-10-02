# Databricks analytics and system tables

## What this source may contain

A connected warehouse may provide product events, usage or billing records, experiment exposures, pipeline lineage, and query telemetry. Its catalog, schemas, event semantics, retention, refresh lag, permissions, and tool interfaces are deployment-specific. Do not infer them from this reference.

Possible sources include event tables, documented dbt models, experiment tables, and enabled Databricks system tables. Names such as `stg_<source>_<event>` and columns such as `_timestamp`, `_id`, or `properties_<name>` are illustrative conventions only. They are not guaranteed to exist, be deduplicated, be typed, or be clustered. Notebooks may require a separate connected interface; report unavailable notebook evidence as a gap.

## Discover before querying

1. Confirm this source is in the user's authorized investigation scope. Discover the actual connected tool inventory and read the relevant tool schema. Do not assume a SQL MCP, an `execute_sql_read_only` tool, or a `poll_sql_result` tool exists. Use only its documented read-only path; a tool's name alone does not establish that it cannot mutate data.
2. Establish the real catalog, schema, table, and accessible columns from metadata and repository/source documentation. When the connected SQL interface supports them, `SHOW TABLES IN <catalog>.<schema>` and `DESCRIBE TABLE <catalog>.<schema>.<table>` can establish names and types. Replace placeholders only with observed identifiers. A cached convention does not justify skipping schema verification.
3. Verify the timestamp semantics, event identity, deduplication key, null handling, units, refresh lag, retention, and coverage for the relevant historical window. Prefer a curated model only when its lineage and quality properties are established. Do not assume raw events contain duplicates or that every model is refreshed on the same schedule.
4. Bound queries to the question's time window and necessary fields. Use the actual time column and its timezone. Limit returned rows and inspect the documented cost controls before scanning a large table. Do not impose a universal 30-day window on an unrelated question.
5. If a query is asynchronous, poll its actual statement/job ID through the documented connected interface. Do not rerun it merely because the first response is pending. Report unavailable metadata, permission, cost, or freshness evidence rather than inventing a result.

## Useful investigation patterns

- **Usage trajectory.** Compare verified event counts before and after a change. Establish launch timing and instrumentation stability from the repository or release evidence. A volume step is circumstantial evidence, not proof that the code caused a behavior change.
- **Threshold origin.** Compare a documented measured distribution with the relevant constant and its introduction date. State units, filters, sample coverage, and whether the threshold rationale was directly documented or inferred.
- **Experiment history.** Use the actual exposure/outcome schema and verified flag or experiment identity. Confirm what a status or variant means before reporting a decision.
- **Query history.** If enabled and accessible, query the actual system-history schema for the table/symbol and time window. Verify duration, bytes, and query-text field names from metadata. Query telemetry can support a cost/performance hypothesis; it does not establish the author's motivation by itself.
- **Pipeline lineage.** Trace an observed model to its actual dbt or pipeline source and Git history. Return the concrete path to the Git investigator when the rationale lives there.

## Evidence and pitfalls

Pair temporal correlations with a source-backed code, commit, PR, or decision record before claiming causation. Check instrumentation changes, schema drift, retention gaps, model creation dates, partial rollout, and refresh lag. Zero returned rows can mean absent coverage rather than absent activity.

Do not fall back to a raw table until its schema, identity, time semantics, and authorized scope are verified. Deduplicate only with a demonstrated identity key and documented intended semantics. Keep raw user data out of the report; return compact aggregates sufficient for the question.

## What to return

For each finding, return the source type, observed fully qualified table, exact read-only query, queried time window and timezone, compact measured summary, lineage/quality evidence, and direct/circumstantial/weak classification. Cite the actual query result or durable investigation artifact. State missing coverage, permissions, refresh lag, or tool access as a gap. Label a historical cause inferred from correlation as an inference.
