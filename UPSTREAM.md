# Upstream

Most of this profile started as a port of
[pstack](https://github.com/cursor/plugins/tree/main/pstack)
by [Lauren Tan (poteto)](https://x.com/poteto).
It was adapted from a Cursor plugin to Claude Code, then changed heavily.

A few skills come from
[cursor-team-kit](https://github.com/cursor/plugins/tree/main/cursor-team-kit),
the Cursor plugin that pstack relies on for UI control, CLI control, and code cleanup.

Both are MIT licensed. Their license texts are in [`licenses/`](licenses/).

## Base commit

Both plugins come from the same commit of `cursor/plugins`:

| Plugin | Version | Commit |
| --- | --- | --- |
| pstack | 0.15.6 | [`23e4138`](https://github.com/cursor/plugins/tree/23e4138daa01c42d4969f7a5465f82704e64f798/pstack) |
| cursor-team-kit | 1.2.0 | [`23e4138`](https://github.com/cursor/plugins/tree/23e4138daa01c42d4969f7a5465f82704e64f798/cursor-team-kit) |

Full hash:

```text
23e4138daa01c42d4969f7a5465f82704e64f798
```

## Where each file came from

Each entry reads **local path** ← upstream path.
Upstream paths are relative to the plugin's directory in `cursor/plugins`.
Anything not listed here is original to this profile.

### From pstack

**Instructions and playbooks**

- `CLAUDE.md`, `references/execution.md`, and `references/principles.md`
  ← `skills/poteto-mode/SKILL.md`, rewritten
- `playbooks/` ← `skills/poteto-mode/playbooks/`
- `references/review-bot-triage.md` ← `skills/poteto-mode/references/bugbot-triage.md`

**Tools**

- `tools/workflow/watch-pr/`, `tools/workflow/orch/`, `bootstrap.ts`, `package.json`, and `bun.lock`
  ← `skills/poteto-mode/scripts/`
- `tools/workflow/check-plan.ts` ← `skills/poteto-mode/scripts/check-plan.mjs`, ported to TypeScript
- `tools/workflow/worktree-audit.ts` ← `skills/poteto-mode/scripts/worktree-audit.sh`, ported to TypeScript
- `tools/workflow/decision-log.ts` ← `skills/show-me-your-work/scripts/log.sh`, ported to TypeScript
- `tools/workflow/file-guard.ts` and `tools/workflow/helpers.test.ts`
  ← the lock helper and tests for the ported scripts above

**Agents**

- `agents/engineer.md` ← `agents/poteto-agent.md`
- `agents/comment-reviewer.md` ← `agents/comment-sicko.md`

**Renamed skills**

- `skills/edit-prose/` ← `skills/unslop/`
- `skills/plain-language/` ← `skills/bro/`
- `skills/review-comments/` ← `skills/no-comments/`

**Issue automation**

- `skills/triage-issue-reports/` and `skills/reproduce-and-fix-issues/` ← `automations/benny/skills/`
- `automations/issue-workflows/`
  ← `automations/benny/templates/` and the references of the two skills above

**Skills with the same name upstream**

These come from the skill of the same name under pstack's `skills/`:

`architect`, `arena`, `benchmark-checklist`, `blast-radius`,
`create-verification-skill`, `figure-it-out`, `how`, `interrogate`,
`maintain-verification-skill`, `recall`, `reflect`, `show-me-your-work`,
`swarm`, `tdd`, `teach`,
`technical-writing`, `typescript-best-practices`, `why`,
and every `principle-*` skill.

### From cursor-team-kit

- `skills/control-cli/` ← `skills/control-cli/`
- `skills/control-ui/` ← `skills/control-ui/`
- `skills/clean-code/` ← `skills/deslop/`

## Related projects and sources

The pstack README points to these, and some of the skills here cite them.
They are worth reading if you want to understand where this setup comes from.

- **[The pstack guide](https://github.com/cursor/plugins/tree/main/pstack/docs/guide)**
  walks through a first real task with pstack,
  from setup and prompting through verification and overnight runs.
  Most of it carries over to this profile.
- **[benny](https://github.com/cursor/plugins/tree/main/pstack/automations/benny)**
  is pstack's automation pack.
  It triages Slack issue reports, then reproduces and fixes confirmed bugs with real UI evidence.
  Here it became `automations/issue-workflows/` and the two issue automation skills.
- **[cursor-team-kit](https://github.com/cursor/plugins/tree/main/cursor-team-kit)**
  is the plugin that pstack expects next to it.
  pstack uses its `deslop`, `control-cli`, and `control-ui` skills.
  The kit has other skills that this profile does not use.
- **[Cursor](https://cursor.com/docs)**
  has built-in `/create-skill` and `/babysit` commands that pstack relies on.
  Here, `skills/author-skill/` and `playbooks/babysit.md` cover those jobs.
- **Writing standards** that `skills/technical-writing/` builds on:
  - [Diátaxis](https://diataxis.fr/)
  - [Google developer documentation style guide](https://developers.google.com/style)
  - [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/)
  - John R. Kohl, *The Global English Style Guide* (SAS Press)

## Sync with upstream

This profile has drifted far from pstack, so a sync is a review, not a merge.
Nothing is ported by default.
Go through the new upstream commits one at a time, oldest first, together with the user.
For each change in a commit, decide together whether it fits this profile.

1. From the profile root, clone `cursor/plugins` into a temporary directory.
   `BASE` is read from the full hash under [Base commit](#base-commit):

   ```bash
   BASE=$(grep -m1 -E '^[0-9a-f]{40}$' UPSTREAM.md)
   UP=$(mktemp -d)
   git clone --filter=blob:none https://github.com/cursor/plugins.git "$UP"
   ```

2. List the upstream commits since the base, oldest first:

   ```bash
   git -C "$UP" log --reverse --oneline "$BASE"..origin/main -- pstack cursor-team-kit
   ```

3. Take the oldest commit that is left, and read its diff:

   ```bash
   git -C "$UP" show <commit> -- pstack cursor-team-kit
   ```

4. Present each change in the commit to the user, one at a time. For each change, give:
   - what upstream added or changed, and why, from the commit message
   - the matching local file from [Where each file came from](#where-each-file-came-from), or that there is none
   - how the change compares with the local version
   - a recommendation to port, adapt, or skip, with the reason

   The user decides each change.
   Do not edit any file until every change in the commit has a decision.

5. Make the accepted edits.
   When a new upstream file is ported, add it to [Where each file came from](#where-each-file-came-from).

6. Move [Base commit](#base-commit) to this commit.
   Update the commit in both table rows and the full hash.
   Read each plugin's version at this commit:

   ```bash
   git -C "$UP" show <commit>:pstack/.cursor-plugin/plugin.json
   git -C "$UP" show <commit>:cursor-team-kit/.cursor-plugin/plugin.json
   ```

7. Make one local commit for this upstream commit.
   - If anything was accepted, the commit holds the ported changes and the base update.
     Use a subject like `Sync pstack 0.15.6 (23e4138): add the benchmark checklist`.
   - If nothing was accepted, the commit holds only the base update.
     Use a subject like `Sync pstack 0.15.7 (9511e60): nothing ported`.

   In the body, list each skipped change and the reason, so a later sync does not reopen it.

8. Go back to step 3 with the next commit.
   Stop when none are left or when the user says to stop.

9. At the end of the sync, check that [Base commit](#base-commit) names the last upstream commit you reviewed,
   and that both versions match that commit's `plugin.json` files.
   If anything is off, fix it in its own commit.
