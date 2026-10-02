<div align="center">

# claude-config

**My Claude Code profile:<br>instructions, skills, agents, playbooks, and helper tools.**

![Claude Code](https://img.shields.io/badge/Claude_Code-profile-D97757)
![platforms](https://img.shields.io/badge/platforms-Linux_%7C_Windows-2EA44F)
![runtime](https://img.shields.io/badge/tools-bun-F9F1E1?logo=bun&logoColor=black)

</div>

This repo is the `~/.claude` directory itself.
Clone it into place, and Claude Code loads every instruction, skill, and agent on its next start.

Session transcripts, credentials, and caches live in the same directory,
but `.gitignore` keeps them out of the repo.

## Requirements

**Every machine**

- [Claude Code](https://code.claude.com/docs/en/setup)
- [git](https://git-scm.com/downloads)
- [GitHub CLI](https://cli.github.com/), signed in with `gh auth login`
- [Bun](https://bun.sh/), which runs the scripts in `tools/`

**Per language**, when you work in that kind of project

- JavaScript and TypeScript: Bun from the list above.
  Projects that already use [pnpm](https://pnpm.io/installation) also need pnpm.
- [uv](https://docs.astral.sh/uv/getting-started/installation/) for Python
- [Go](https://go.dev/doc/install).
  Claude installs `gofumpt`, `golangci-lint`, and `govulncheck` when they are missing.
- [Rust](https://rustup.rs/) through rustup.
  Claude adds `rustfmt` and `clippy` when they are missing.

**Optional**

- [Google Chrome](https://www.google.com/chrome/) with the [Claude in Chrome](https://claude.com/claude-in-chrome) extension,
  for the skill that reads pages behind your sign-ins
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

## Sync between machines

After you change a skill or an instruction, push the change:

```bash
cd ~/.claude
git add -A
git commit -m "Describe the change"
git push
```

On the other machine, pull it:

```bash
cd ~/.claude
git pull
```

> [!NOTE]
> Claude Code rewrites `settings.json` when you change options such as the model or theme.
> Expect small diffs in that file.

## Credits

This profile is a heavily modified port of
[pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan (poteto),
with a few skills from [cursor-team-kit](https://github.com/cursor/plugins/tree/main/cursor-team-kit).
Both are MIT licensed.

[UPSTREAM.md](UPSTREAM.md) lists the base commit, where each file came from, and how to check for upstream changes.
