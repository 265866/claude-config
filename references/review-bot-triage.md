# Automated reviewer triage

Use this reference when the Babysit playbook (`../playbooks/babysit.md`) handles automated reviewer or review-automation comments. The goal is not to ignore automated reviewers by default. The goal is to stop treating every comment as a required code change.

## Decision rubric

Classify each automated reviewer thread before acting. Apply these rules in order; the first one that matches decides:

1. `fix`: The current code or a reproduction proves a real issue, in any category. Fix it locally in the PR that Babysit step 8 names (the lowest owning PR, or in `threads-only` the PR that holds the thread when that PR owns the code). When you fix it, prepare a reply that cites the commit SHA; otherwise report it, as that step says.
2. `ask`: The finding is in a high-risk category (listed under "Never auto-dismiss" below) and is not proven. Never dismiss it yourself. Ask the user, and attach any concrete disproof or matching skip pattern as evidence for their decision.
3. `dismiss`: The current code or a reproduction concretely disproves the concern, or a documented skip pattern below matches with all of its conditions met. Prepare a reply with a short reason and the evidence.
4. `fix`: The issue is unproven, but the suggested fix is small and clearly reduces risk without changing product intent.
5. `ask`: Anything else, such as a novel or ambiguous comment that a reproduction, a test, or the current code within reach cannot settle. Try those first; ask only when evidence cannot decide, and continue other work while asking.

Pushing the fix to the PR's branch proceeds under Babysit steps 1 and 5. Posting the reply and resolving the thread are separate ask-first writes, as Babysit step 9 describes. A fix or disproof is a valid deliverable while that approval is pending. In a read-only request, including Babysit `check`, report the classification and offer the fix without editing.

When evidence within reach cannot settle it, ask. Skipping a noisy code-quality comment is cheap; skipping a real data or security bug is not.

## Learned pattern format

When profile maintenance is requested, add approved patterns in this shape:

```markdown
### <short pattern name>

- Confidence: candidate | recurring | strong
- Skip when: <conditions that must be true>
- Do not skip when: <risk boundaries>
- Example signal: <phrases or code context that identify the pattern>
- Source: <PR/comment URL or short historical note>
```

Use `candidate` for one or two examples. Use `recurring` after multiple real dismissals. Use `strong` only when the pattern is narrow, repeatedly verified, and low-risk.

## Recurring skip candidates

### Intentional UI or design-system visual changes

- Confidence: candidate
- Skip when: The PR description, screenshots, design review, or nearby code makes the visual change explicit, and the automated reviewer comment is only restating that a shared visual default changed.
- Do not skip when: The comment points to accessibility, focus visibility, keyboard navigation, color contrast, or a component API contract that the PR did not intentionally change.
- Example signal: Comments about focus outlines, button sizes, spacing, or shared component visual defaults where the owner replies "intentional" or "intended".
- Source: historical dismissals inherited from the upstream pstack triage reference; individual PRs were not recorded.

### Upstack or stack-local usage the automated reviewer cannot see

- Confidence: candidate
- Skip when: An automated reviewer flags an export, component, helper, or file as unused, and the active forge's PR list and diffs, upper-stack diffs, or PR context show it is used by a later PR in the stack.
- Do not skip when: The current PR is not part of a stack, the symbol is public API, or the supposed upstack use cannot be verified.
- Example signal: "Exported component is never used" with a human reply like "used upstack".
- Source: historical dismissals inherited from the upstream pstack triage reference; individual PRs were not recorded.

### Temporary duplication during parallel implementation

- Confidence: candidate
- Skip when: The PR intentionally duplicates a small amount of code to keep a new path parallel to an old path that is being deleted, replaced, or proven out.
- Do not skip when: The duplicated code changes security, billing, data access, API behavior, or a long-lived shared abstraction would clearly reduce risk.
- Example signal: "Significant duplication" or "duplicated validation logic" where the owner explains the old path will be deleted or the duplicate logic is intentionally local.
- Source: historical dismissals inherited from the upstream pstack triage reference; individual PRs were not recorded.

### Existing framework or component invariant covers the warning

- Confidence: candidate
- Skip when: The concern is already guaranteed by a shared component, framework contract, type invariant, or single source of truth visible in the current diff or nearby code.
- Do not skip when: The invariant is assumed but not enforced, depends on timing, or crosses async/state boundaries where values can diverge.
- Example signal: Comments about missing max-height on an inner popover when the shared popover enforces viewport bounds, or nullable values where the local checked value and passed value share the same source.
- Source: historical dismissals inherited from the upstream pstack triage reference; individual PRs were not recorded.

### Owner-declared follow-up or deferred cleanup

- Confidence: candidate
- Skip when: The PR owner explicitly says the issue is a known follow-up, the behavior is not made worse by the current PR, and the comment is not about a high-risk area.
- Do not skip when: The agent is acting without owner input, the issue is medium/high severity product behavior, or deferring would merge a new regression.
- Example signal: "I'll worry about that later" or "we'll delete this eventually".
- Source: historical dismissals inherited from the upstream pstack triage reference; individual PRs were not recorded.

### Self-withdrawn or explicit false-positive rule comments

- Confidence: recurring
- Skip when: The comment body or a later automated reviewer reply explicitly says the finding is withdrawn, compliant, or a false positive, and the agent can verify the relevant rule locally.
- Do not skip when: The only evidence is a human saying "false positive" on a high-risk issue without explanation, or the finding is in a "Never auto-dismiss" category (rubric rule 2 applies; cite the withdrawal as evidence).
- Example signal: A file-naming rule comment whose body says the file is already compliant.
- Source: historical dismissals inherited from the upstream pstack triage reference; individual PRs were not recorded.

## Never auto-dismiss

These are the high-risk categories that rubric rule 2 sends to `ask` unless a real issue is proven. Do not dismiss them yourself, through a skip pattern or a disproof, even if a previous PR dismissed something similar:

- Security, privacy, auth, billing, data retention, training-data, and permission-boundary findings.
- High-severity findings.
- Migration, schema, idempotency, concurrency, race, and cross-system behavior findings.

Historical data showed humans sometimes dismiss security/data-flow comments. Treat those as owner judgment calls, not team-wide skip rules.

## Candidate learnings from recent babysits

During ordinary babysitting, propose useful candidate learnings in the task report or its project-scoped evidence. Update this installed reference only when profile maintenance is requested. In that maintenance pass, add proven candidates and promote recurring ones once several PRs confirm the pattern.

### Manual reimplementations of native browser behavior

- Confidence: candidate
- Skip when: Practically never. When a diff replaces native browser behavior with a manual equivalent (native sticky → JS-positioned clones, native scroll targeting → forwarded wheel/touch events, paint-order occlusion → masks/clip-path), the automated reviewer's logic-bug findings against that code have been consistently legitimate.
- Do not skip when: The finding concerns event-forwarding gaps (wheel deltaMode, touch pans, scroll-chaining at edges, tap slop), mask/clip hit-testing divergence, or observer-vs-React state timing races in such code. Reproduce the claim first; in this code it has usually proven real, which makes it a rubric rule 1 `fix`.
- Example signal: "masks do not affect hit-testing", "overlay blocks wheel scroll", "ignores deltaMode", "runs in the IntersectionObserver callback before React applies state".
- Source: one sticky-occlusion PR: six automated reviewer passes, roughly eighteen findings, every one fixed rather than dismissed.

### Contract-test drift claims are cheaply verifiable, so run the test first

- Confidence: candidate
- Skip when: Never skip the verification itself; it costs one command. When a PR
  ships a contract test that pins protocol or documentation prose (regexes over
  a SKILL.md, snapshot of doc wording), and the automated reviewer claims "the test no longer
  matches the doc" (or vice versa), run that test on the PR tip before
  classifying. A red run confirms the claim empirically; a green run is a
  concrete disproof for the dismissal reply.
- Do not skip when: n/a. This is a verification shortcut, not a dismissal
  pattern. Note that repeat-pass lean-dismiss heuristics would misfire here:
  prose-pinning tests drift precisely BECAUSE earlier fix rounds edit the prose.
- Example signal: "Contract test omits the pre-fix wait" on a PR whose earlier
  fix commits reworded the pinned passage; the test run on the tip failed on
  exactly the cited assertion.
- Source: one prose-pinning PR with eight automated reviewer passes; the claim was real on
  pass 7 despite every earlier pass being fixed-and-resolved.

### Stale security-review finding already fixed later in the same PR

- Confidence: candidate
- Skip when: Never on your own, because auth findings fall under "Never auto-dismiss". When an agentic security review (or similar) claims a missing authz/validation call and the current PR tip clearly includes that exact gate (with tests), typically added in a later hardening commit after the review ran, ask under rubric rule 2 with that gate and its tests as the concrete disproof, and recommend dismissal.
- Do not skip when: The cited helper is a no-op for the principal under discussion, the check runs after the side effect it guards, or coverage for the claimed principal is missing.
- Example signal: A HIGH "missing authorization check" finding while the exact guard is already called before the side effect on the tip.
- Source: one webhook-endpoint PR whose hardening commit postdated the review run.

### Widening a deliberately narrow error condition would mask the real error

- Confidence: candidate
- Skip when: The finding asks to broaden a narrow error condition (a specific
  `errno`, error code, or status class) into a catch-all, and that narrowness
  encodes a real distinction. The canonical shape is a dependency fallback
  gated on `ENOENT`: "binary is not installed" is a different situation from
  "the command ran and failed". Retrying on any non-zero exit would re-run a
  legitimate failure (not found, expired auth, network) against the fallback
  and then report the fallback's error, hiding the true one.
- Do not skip when: The narrow condition misses a case in the SAME category
  (another "binary unusable" errno such as `EACCES`, another transport-level
  failure), the unhandled path loses data or leaves partial state, or the retry
  is idempotent AND the original error is still surfaced.
- Example signal: "only retries when X fails with ENOENT … never tries the
  fallback even when a working Y exists", pointing at code whose fallback
  exists for a missing dependency rather than a failed operation.
- Source: one CLI-rename PR whose fallback existed for a missing binary rather
  than a failed command.
