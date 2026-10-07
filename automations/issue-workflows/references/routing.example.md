# Routing map example

Use a completed routing map at a user-managed absolute path outside the installed profile, for example `<home>/claude-runtime/issue-workflows/routing.md` with `<home>` replaced by the user's home directory. Set `routing.map_path` to that path. The bundled example is data documentation, not a live route; profile refreshes must not overwrite the user-managed map.

The triage skill treats this as data. A route needs evidence from the report or cause trace. A keyword match alone is not enough.

```yaml
routes:
  - name: "billing-example"
    match:
      product_areas:
        - "billing-area-placeholder"
      code_paths:
        - "billing-code-path-placeholder"
      error_signatures:
        - "billing-error-placeholder"
    destination:
      slack_channel: "BILLING_CHANNEL_ID_PLACEHOLDER"
      tracker_team: "billing-team-placeholder"
    owners:
      - "billing-owner-placeholder"
    allow_feature_owner_ping: false

  - name: "desktop-example"
    match:
      product_areas:
        - "desktop-area-placeholder"
      code_paths:
        - "desktop-code-path-placeholder"
      error_signatures:
        - "desktop-error-placeholder"
    destination:
      slack_channel: "DESKTOP_CHANNEL_ID_PLACEHOLDER"
      tracker_team: "desktop-team-placeholder"
    owners:
      - "desktop-owner-placeholder"
    allow_feature_owner_ping: false

fallback:
  destination:
    slack_channel: ""
    tracker_team: ""
  owners: []
  allow_feature_owner_ping: false

ping_policy:
  default: "off"
  allow:
    - "configured-feature-owner"
    - "confirmed-regression-author"
  deny:
    - "broad-on-call-group"
    - "unverified-owner"
```

## Rules

- Leave `fallback.destination.slack_channel` and `fallback.destination.tracker_team` empty unless one team accepts all unmatched reports.
- Use stable product areas, code paths, and error signatures.
- Do not include private data in a public copy.
- `destination.slack_channel` is a Slack channel ID, so triage can compare it with the source channel ID. Keep real IDs out of any copy that will be published.
- Do not paste raw user or channel IDs into an example that will be published.
- Keep feature-owner pings off until the target team agrees to them.
- A reroute tells the reporter where to go. The automation never cross-posts.
