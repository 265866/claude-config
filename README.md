<div align="center">

# claude-config

**My Claude Code profile: instructions, skills, agents, playbooks, and helper tools.**

![Claude Code](https://img.shields.io/badge/Claude_Code-profile-D97757)
![platforms](https://img.shields.io/badge/platforms-Linux_%7C_Windows-2EA44F)
![runtime](https://img.shields.io/badge/tools-bun-F9F1E1?logo=bun&logoColor=black)

</div>

This repo is the `~/.claude` directory itself. Clone it into place and Claude Code picks up every instruction, skill, and agent on its next start. Session transcripts, credentials, and caches live in the same directory but never enter the repo.

## Install the tools it uses

The instructions and helper scripts call these tools. Install them on every machine:

- [Claude Code](https://code.claude.com/docs/en/setup)
- [git](https://git-scm.com/downloads)
- [GitHub CLI](https://cli.github.com/) (`gh`), signed in with `gh auth login`
- [Bun](https://bun.sh/), which runs the scripts in `tools/`

Install these when you work in the matching kind of project:

- [pnpm](https://pnpm.io/installation) for JavaScript and TypeScript projects that already use pnpm
- [uv](https://docs.astral.sh/uv/getting-started/installation/) for Python
- [Go](https://go.dev/doc/install). Claude installs `gofumpt`, `golangci-lint`, and `govulncheck` with `go install` when they are missing.
- [Rust through rustup](https://rustup.rs/). Claude adds `rustfmt` and `clippy` with `rustup component add` when they are missing.

These are optional:

- [Google Chrome](https://www.google.com/chrome/) with the [Claude in Chrome](https://claude.com/claude-in-chrome) extension, signed in to the accounts Claude may read. The browser-account skill needs it.
- [tmux](https://github.com/tmux/tmux/wiki/Installing) for driving terminal apps

## Install it on a new machine

To install before the first `claude` run:

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

`git checkout -f` overwrites local copies of tracked files such as `CLAUDE.md` and `settings.json`. Untracked runtime files stay as they are.

## Keep machines in sync

After changing a skill or instruction:

```bash
cd ~/.claude && git add -A && git commit -m "..." && git push
```

On the other machine, run `git pull` in `~/.claude`. Claude Code also rewrites `settings.json` when you change the model, theme, or other options through `/config`, so expect small diffs in that file.
