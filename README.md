# claude-config

My Claude Code profile: instructions, skills, agents, playbooks, and helper tools.

This repo is the `~/.claude` directory itself.
Clone it into place, and Claude Code loads every instruction, skill, and agent on its next start.

Session transcripts, credentials, and caches live in the same directory,
but `.gitignore` keeps them out of the repo.

## Requirements

**Every machine**

- [Claude Code](https://code.claude.com/docs/en/setup)
- [git](https://git-scm.com/downloads)
- [GitHub CLI](https://cli.github.com/), signed in with `gh auth login`
- [Bun](https://bun.sh/) 1.3.3 or later, which runs the scripts in `tools/`, the hook in `hooks/`, and skill scripts

**Per language**, when you work in that kind of project

- JavaScript and TypeScript: Bun from the list above.
  Projects that already use [pnpm](https://pnpm.io/installation) also need pnpm.
- [uv](https://docs.astral.sh/uv/getting-started/installation/) for Python
- [Go](https://go.dev/doc/install).
  Claude installs `gofumpt`, `golangci-lint`, and `govulncheck` when they are missing.
- [Rust](https://rustup.rs/) through rustup.
  Claude adds `rustfmt` and `clippy` when they are missing.

**Optional**

- [Google Chrome](https://www.google.com/chrome/), kept for agents only,
  for the agent-chrome skill, which reads pages that block plain fetching and pages behind your sign-ins.
  See [Agent Chrome](#agent-chrome).
  On Linux, also install `xdotool` so that Chrome stays minimized.
- [tmux](https://github.com/tmux/tmux/wiki/Installing), for driving terminal apps

## Install

On a machine that has never run `claude`:

```bash
git clone git@github.com:265866/claude-config.git ~/.claude
```

If `~/.claude` already exists:

```bash
cd ~/.claude
git init -b main
git remote add origin git@github.com:265866/claude-config.git
git fetch
git checkout -f main
```

> [!WARNING]
> `git checkout -f` replaces your local `CLAUDE.md`, `settings.json`, and any other tracked file.
> Untracked runtime files stay as they are.

The `tools/workflow/orch` and `tools/workflow/watch-pr` tools install the workflow dependencies the first time either runs.
To run the tests or typecheck before that, install them first:

```bash
cd ~/.claude/tools/workflow
bun install --frozen-lockfile
```

## Agent Chrome

The `agent-chrome` skill reads web pages that block plain fetching, and pages behind your sign-ins, through a Chrome that only agents use.
A hook in `settings.json` runs `hooks/blocked-fetch.ts` after WebFetch, and after Bash or PowerShell commands that run curl, wget, Invoke-WebRequest, or Invoke-RestMethod. When a public page refuses the request, it reminds the agent to read that page through the skill.
Claude Code starts the hook with Bun directly, without a shell, so it does not matter whether Claude Code would run hooks through sh, Git Bash, or PowerShell.
When `bun` is not on Claude Code's PATH, those calls show a hook error.
On Windows, PATH needs the real `bun.exe`, as the bun.sh installer, winget, and scoop provide, since Claude Code cannot start a `bun.cmd` shim without a shell.
Run `bun test hooks/` from `~/.claude` to check the hook against recorded block pages and known false positives.
The skill needs Google Chrome 149 or later.
It supports Windows, macOS, and Linux with Google's Chrome package, and other Unix-like systems are unsupported.
The skill runs Chrome from its own profile folder, which keeps your sign-ins:

- Windows: `%LOCALAPPDATA%\agent-chrome`
- macOS: `~/Library/Application Support/agent-chrome`
- Linux: `$XDG_DATA_HOME/agent-chrome`, by default `~/.local/share/agent-chrome`

During a task, Chrome runs out of your way with a local debugging port, and the skill closes it when the task ends.
On Windows it starts minimized and on macOS hidden.
On Linux it is minimized only when [xdotool](https://github.com/jordansissel/xdotool) is installed and the session has an X11 or XWayland display;
otherwise its window shows while a task runs.
On Linux the skill expects Google's package, which installs Chrome at `/opt/google/chrome`.
Its workers drive Chrome with [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp),
which Bun downloads on first use at the version pinned in `skills/agent-chrome/scripts/agent-chrome.ts`.
Nothing needs installing beyond Chrome and Bun.

Sign in to the sites you want agents to read:

```bash
bun ~/.claude/skills/agent-chrome/scripts/agent-chrome.ts signin
```

A normal Chrome window opens. Sign in to each account, keep "stay signed in" checked, and close the window.
Chrome closes after every task, so a sign-in that lasts only until the browser closes does not carry over.
When a task reports that a site needs a sign-in, run the same command again.

> [!NOTE]
> Sign in through that command, not through an agent Chrome that a task opened.
> That command opens Chrome without its debugging port, which sign-in pages such as Google's may detect and refuse.

## Sync between machines

After you change a skill or an instruction on `main`, check for changes you did not mean to keep:

```bash
cd ~/.claude
git status
```

When it shows only changes you mean to keep, push them:

```bash
git add -A
git commit -m "Describe the change"
git push origin main
```

On the other machine, with `~/.claude` on `main`, pull it:

```bash
cd ~/.claude
git pull --ff-only origin main
```

Or tell Claude "sync profile". The sync-profile skill commits and pushes this machine's changes, pulls them on each other machine it can reach over SSH, then shows which commit each one is on.

> [!NOTE]
> Claude Code rewrites `settings.json` when you change options such as the model or theme.
> Expect small diffs in that file.

## Credits

This profile is a heavily modified port of
[pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan (poteto),
with a few skills from [cursor-team-kit](https://github.com/cursor/plugins/tree/main/cursor-team-kit).
Both are MIT licensed.

[UPSTREAM.md](UPSTREAM.md) lists the base commit, where each file came from, and how to sync with upstream.
