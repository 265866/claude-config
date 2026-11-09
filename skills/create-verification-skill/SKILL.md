---
name: create-verification-skill
description: "Generate a project-local verification skill that drives your app the way a user does, for any language, framework, or platform, or audit and maintain an existing one and its feature map. Use for /create-verification-skill, \"make a control skill for this repo\", when a project has no scripted way to prove UI/CLI/service behavior, or to audit, update, or maintain a verification skill or feature map. Audits report proven gaps without edits; authorized maintenance prepares one local patch of corrections."
---

# Create a verification skill

Every serious project needs a scripted way to drive the real app and prove behavior: launch it, exercise a feature the way a user would, and capture evidence. This skill generates that as a project-local skill (`.claude/skills/verify-<app>/`) tailored to the repo. You write the generator's output for the next agent, not for a human. It will be read cold, mid-task, by an agent that has never seen the app.

To audit or maintain an existing verification skill instead, follow [Audit and maintain](#audit-and-maintain) below.

The main coordinator selects the executor using [execution guidance](${CLAUDE_SKILL_DIR}/../../references/execution.md). A small app can be inspected and driven directly. Broader independent source investigation may be batched, but shared live instances have one serial driver. Assigned investigators do not restart routing or generate another enclosing verification procedure.

## 1. Interview the repo, not the user

Answer these from the codebase and only ask the user what you cannot observe:

- **Surface:** what does a user actually touch? A web UI, a CLI/TUI, a desktop app, an API, a mobile app, a library? A repo can have several; pick the primary one and note the rest. Use existing browser, browser MCP, CLI, PTY, or app harnesses actually available in this Claude Code session. Any browser automation, including a browser MCP or a CDP recipe, runs its own browser and never uses the user's own browser profiles or the agent Chrome profile, per control-ui. Do not assume a built-in browser API exists.
- **Run:** how does the app start locally? Prefer the repo's own documented dev command (package scripts, Makefile, README quickstart). Note ports, env vars, seed data, auth.
- **Drive:** how can an agent interact with it programmatically? Check existing harnesses first, such as Playwright/Cypress specs, expect scripts, PTY helpers, HTTP endpoints, or a debug port. Only then pick a generic recipe: browser/CDP for web and Electron, a tmux/PTY harness for CLI/TUI, or plain HTTP for services.
- **Observe:** what evidence can be captured? Screenshots, terminal transcripts, response bodies, logs, exit codes, DB state.
- **Isolate:** can two instances run side by side (ports, data dirs, profiles)? If not, say so in the generated skill: refusing to double-drive a shared instance beats corrupting the user's session.

If the checkout doesn't build or start as-is, report the exact build or start failure and stop before generating unless you can fix it: a defect in the project's code that blocks the requested skill gets fixed as its own verified change (CLAUDE.md, Authorization and ownership), and you stop only when the fix needs an ask-first action or a product decision. A skill written against a broken base teaches wrong steps. If startup needs a missing real asset or configuration, report that prerequisite. Do not generate a substitute, and change product code only for such a blocking fix.

## 2. Generate the skill

Write `.claude/skills/verify-<app>/SKILL.md` with YAML frontmatter containing `name: verify-<app>` and a `description` that names the app, surface, and trigger. Include the sections below, grounded in the actual repository findings with no placeholders left.

- **Launch:** the exact command that starts the app for verification, and how to tell it's ready (a log line, a prompt). Launch must reach a usable state from an empty data dir, including any migrations and seed data. Ready means usable, not just that a process answers. A database health check can pass while its init scripts are still running. Include teardown. For a short-lived CLI or TUI there is no server to keep alive, so launch means building the binary once, then starting each drive in its own isolated PTY or tmux session. Install the project's declared dependencies with the package manager rules/toolchains.md selects for the project (add a new dependency when the build needs it, and report it); in a project with an npm or yarn lockfile, ask the user before this install or any dependency change, as rules/toolchains.md says.
- **Doctor:** one read-only check that answers "is this instance worth driving?" Confirm the process is up, the version/build is correct, this run owns the port, and authentication is valid. Run this check first whenever anything looks off.
- **Drive:** the harness recipe with real selectors/commands from this repo, not examples. Prefer stable handles (ARIA labels, data attributes, prompt strings, route paths) over coordinates and tab order.
- **Evidence:** what to capture for a proof and where it goes. State the proof standards: exercise the real user path, not internal setters or test-only endpoints; capture the action and the resulting state, not just the final screen; verify side effects (files written, rows inserted, messages sent) alongside what's visible; use a mock or stand-in only when the real dependency cannot run, and report the reason. When the safe path is a dry-run or test mode, verify what it actually skips by observing (files, network, git refs) rather than trusting its name: some dry-runs still touch the network or open a browser.
- **Cleanup:** how to tear down instances the run created. Never kill by process name; kill what you started. Cleanup removes instances and scratch state, never the evidence: proof artifacts survive the teardown, in a location the skill names.
- **Helpers:** any script the skill ships is executable and its invocation is shown in the skill body. A helper the reader has to reverse-engineer is not a helper.

## 3. Seed the feature map

Create `.claude/skills/verify-<app>/features/README.md` plus one file per user-facing feature you can identify (aim for the top 3-5 to start, from routes, commands, menus, or docs). Follow the shape in [`references/feature-map-example/`](references/feature-map-example/), with a README index and one file per feature. Each file answers, from the user's point of view: what the feature is, how to reach it, how to drive it with the harness, and what observable end state proves it works. The four H2s are `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, and `Gotchas`. If the seed data lacks a precondition that a journey needs, the journey reports a failure and the reason goes in that feature's `Gotchas`. Never weaken the journey to make it pass. The map is the repo's maintained verification source; a proof that drives one convenient entry point is incomplete when the map lists others.

## 4. Prove the generated skill before handing it over

Run its own instructions end to end once: launch, doctor, drive ONE mapped feature (one is enough; the map exists so later runs can cover the rest), capture evidence, clean up. After cleanup, confirm the evidence still exists at the named location. Cleanup that removes the proof fails this step. Fix what fails, and run the generated cleanup after every failed iteration too, so broken attempts don't strand processes and ports. A generated skill that was never executed is a draft, not a deliverable. If you proved it in a stand-in for the real target, such as a container in place of a fresh VM or a local stack in place of a remote one, list every setup step the stand-in did that the target will not. Those steps stay unverified until a run on the real target covers them.

## 5. Offer the maintenance loop

Explain that [Audit and maintain](#audit-and-maintain) keeps the map honest as the app changes. Suggest a cadence only if they ask.

## Audit and maintain

A feature map can drift when the app changes. This section maintains a skill generated by generation sections 1 through 4 or another project-local verification skill with a feature map. Cover every feature file from source and exercise every feature live, without assigning a separate completion state to every bullet.

Choose the mode from the user's request before starting. An audit or question is read-only. It reports findings and proposed corrections without editing the verification skill, its harness, or product code. A request to update or maintain the skill authorizes corrections within the edit scope below. Both modes require honest source and live coverage; ordinary action-approval rules still apply to live setup, driving, and cleanup.

Source investigation can use independent batches; the live pass has one serial driver. Assigned source readers perform their stages without rerouting or launching another maintenance pass.

### Outcomes

Pick one, and say which. When more than one fits, `blocked` takes precedence over `changed`, and `changed` over `issues`; list any verified corrections and remaining gaps alongside the chosen outcome.

- **clean.** Every feature got source and live coverage, with no doc, harness, map, or product gaps found. No branch or PR is needed.
- **issues.** Coverage completed and proven gaps remain, with no local patch. Report them without edits in audit mode. Maintenance that finds only product gaps also uses this outcome.
- **changed.** Authorized maintenance completed coverage and produced one reviewable local patch of proven doc, harness, or map corrections, or a separate verified product fix under Edit scope. Report any product gaps separately.
- **blocked.** Coverage could not finish, or an authorized maintenance correction could not be prepared or verified within edit scope. Say exactly what blocked it.

### Edit scope

In maintenance mode, the verification-skill patch edits only the skill's own directory (its SKILL.md, features/, and any harness scripts it owns). Audit mode makes no corrections. Audit mode never edits product code. Maintenance mode keeps product code out of the verification-skill patch. A behavior the map describes that the app no longer does is either doc drift or a product regression. Correct proven doc drift only in maintenance mode; report product regressions instead of papering over them in docs. In maintenance mode, a product defect that keeps the app from launching or keeps the live pass from reaching other features gets fixed as its own verified change, as generation section 1 describes, and you stop only when that fix needs an ask-first action or a product decision.

### Pass

0. **Locate the target.** Find the verification skill to maintain: the project-local skill whose body has launch/drive sections and a feature map (usually `.claude/skills/verify-*/`). Several candidates → ask which one; none → stop and offer to generate one with generation sections 1 through 4 instead of inventing a target.

1. **Index hygiene.** Read the feature map README and glob its sibling files. Identify missing, extra, duplicate, or dead entries. Report them in audit mode; correct them in maintenance mode. Lightweight; no generated inventory.

2. **Source wave.** Record the feature-file coverage manifest. Investigate directly for a small map or assign read-only feature slices using the selected executor. Resolve feature and reference paths first. Each explains "how does this user-facing feature work?" from source, flags likely doc drift with citations, and returns one concise live-verification recipe per feature. Children never drive the app and never edit files. Return shape: feature summary / source entry points / likely drift or none / one recipe. Every required feature needs a result; a missing result blocks complete coverage.

3. **Reconcile.** Every feature file has a returned summary. Merge overlapping recipes into as few app states as practical. Spot-check cited drift; don't re-prove clean claims. Sweep recent churn for user-facing surfaces missing from the map. Require a concrete source path before calling one missing.

4. **Live pass.** Required even when source looks clean. The coordinator owns all driving. Follow the verification skill's Launch section: one long-lived instance driven serially for servers and UIs, or a fresh isolated session per drive for short-lived CLIs. Exercise every feature at least once.

   Keep all three invariants throughout the pass, including failures.

   1. Health-check before the first drive, on each fresh session, and after a failed drive. If the instance did something surprising, do not drive it again until checked. If doctor cannot detect the failure, such as a wedged UI on a healthy process, reset to a known state or relaunch.
   2. Preserve captured evidence through every cleanup. Check that it survives at the named location.
   3. Once a drive no longer needs the state and processes it created, clean them up, whether the session is stuck, exited, or shared. For a shared instance, remove this drive's residue while preserving the instance.

   If doctor fails because the skill drifted, audit mode reports the drift and blocked live coverage without repairing the harness. In maintenance mode, fix it within edit scope and retry once before reporting `blocked`. Restart only what the correction invalidates.

   Mark a feature `verified-unreachable` only with the concrete prerequisite (auth, entitlement, OS, or external state) and the route attempted. A missing prerequisite in the map is drift.

   In maintenance mode, re-drive any harness correction live before shipping it. After the last drive, including these rechecks, tear down the run's instances and scratch state while preserving evidence.

5. **Triage.** Wrong or missing user-POV description → doc drift. Working behavior the harness can't drive → harness gap. App behavior that's actually broken → product gap. Audit mode reports these findings with evidence and proposed corrections. Maintenance mode fixes proven doc and harness gaps within edit scope; a harness fix follows the same helpers rule as generation (scripts executable, invocation documented in the skill body). Report product gaps in both modes and keep them out of the verification-skill patch.

6. **Ship or stop.** For changed: prepare one local patch of proven corrections, if any, keep a product fix as its own change, and re-read every changed file. Opening a PR is an ask-first action (CLAUDE.md, Authorization and ownership). Update a PR the task already owns, and report it. For clean, issues, or blocked: no PR, report the outcome and the coverage honestly. An audit stops at its findings; proposed corrections do not authorize applying them.

Keep concise run notes (features covered, unreachable prerequisites, confirmed drift, outcome) in a scratch location; don't commit them.
