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
      slack_channel: "billing-channel-placeholder"
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
      slack_channel: "desktop-channel-placeholder"
      tracker_team: "desktop-team-placeholder"
    owners:
      - "desktop-owner-placeholder"
    allow_feature_owner_ping: false

fallback:
  destination: ""
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

- Leave `fallback.destination` empty unless one team accepts all unmatched reports.
- Use stable product areas, code paths, and error signatures.
- Do not include private data in a public copy.
- Do not paste raw user or channel IDs into an example that will be published.
- Keep feature-owner pings off until the target team agrees to them.
- A reroute tells the reporter where to go. The automation never cross-posts.
