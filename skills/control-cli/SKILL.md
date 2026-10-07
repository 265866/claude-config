---
name: control-cli
description: Build or adapt a local harness to drive, inspect, and profile an interactive CLI or TUI without external services. Use for CLI UX checks, startup regressions, memory leaks, hangs, prompt flows, or terminal demos.
---

# Control CLI

Use a repeatable local harness to exercise an interactive CLI instead of poking at it manually. First reuse the repo's own test/demo harness if it exists; otherwise assemble a temporary harness from tools already installed or throwaway tools under the profile's toolchain rules. On Windows, use an existing ConPTY/PTY or repository terminal harness. The tmux and Python pty examples below require a Unix environment; do not treat them as portable Windows commands.

## What It Is Used For

- Reproducing CLI/TUI bugs with deterministic input.
- Verifying keyboard flows, prompts, interrupts, resize behavior, and terminal layout.
- Capturing before/after transcripts for bug fixes.
- Profiling startup time, slow operations, hangs, or memory growth.
- Recording a short terminal demo when output is easier to show than explain.

## Harness Loop

1. Identify the command under test and the smallest reproducible workspace.
2. Discover existing local harnesses: package scripts, e2e tests, demo recorders, expect scripts, or PTY helpers.
3. If no harness exists, launch the CLI in an isolated terminal session with deterministic env vars.
4. Capture the current screen before interacting.
5. Send one action at a time: text, Enter, arrows, Escape, Ctrl-C, resize.
6. Wait for a concrete screen pattern or prompt before the next action.
7. Save the transcript and any profile artifacts.
8. Kill the session cleanly.

## Harness Options

- Repo-native harness: prefer checked-in scripts because they know the app's startup, env, and prompts.
- `tmux`: managed sessions, `capture-pane`, `send-keys`, attach/detach.
- PTY probe: use an existing Bun/Node/Expect terminal library or harness. Run Python helpers through uv. Bun's built-in `Bun.spawn(cmd, { terminal: { cols, rows, data } })` provides a PTY without a dependency on macOS and Linux, and on Windows through ConPTY as of Bun 1.4.2. Bun 1.3's types document it as POSIX only, so check `bun --version` on Windows. Prefer it before adding node-pty. Add a PTY dependency or tool to the project when the harness needs it, and report it. Throwaway installs outside it follow the profile's toolchain rules.
- Runtime inspector: use Node or Bun inspector for CPU profiles, heap snapshots, and live evaluation.
- Terminal recorder: use repo-local demo tools or asciinema-compatible tools when the user asks for a demo.

## Minimal tmux Harness

```bash
SESSION="cli-harness-$(date +%s)"
trap 'tmux capture-pane -pt "$SESSION" 2>/dev/null; tmux kill-session -t "$SESSION" 2>/dev/null' EXIT
wait_for() {
  for _ in $(seq 1 100); do
    tmux capture-pane -pJt "$SESSION" 2>/dev/null | grep -qF -- "$1" && return 0
    tmux has-session -t "$SESSION" 2>/dev/null || return 1
    sleep 0.1
  done
  return 1
}
tmux new-session -d -s "$SESSION" -- <command-under-test>
wait_for '<ready prompt>' || { echo "CLI never became ready" >&2; exit 1; }
tmux capture-pane -pt "$SESSION"
tmux send-keys -t "$SESSION" "help" Enter
wait_for '<help marker>' || { echo "help output never appeared" >&2; exit 1; }
```

The exit trap captures the final screen and kills the session on success or failure. Markers match as literal text against the visible screen, with wrapped lines joined and trailing spaces kept (`-J`), so pick ones that cannot match startup output or the echoed input. `-J` joins only lines the terminal wrapped; a CLI that breaks its own lines at the pane width, as most TUIs do, still splits them, so keep markers for those within one screen line. Run the whole harness in one script or Bash call, and append any extra cleanup to this trap rather than setting a new `EXIT` trap.

For Node CLIs:

```bash
tmux new-session -d -s "$SESSION" -- env NODE_OPTIONS="--inspect=127.0.0.1:0" <node-cli-command>
```

Read the terminal output to find the inspector URL, then use Chrome DevTools-compatible tooling if profiling is needed.

## Unix PTY example

This uses the Unix-only standard-library pty module. Save the example in a fresh OS temporary directory. From that directory, run `uv run --offline --no-python-downloads --no-project harness.py > transcript.log 2>&1` with an installed interpreter. Confirm `transcript.log` survives process/session cleanup.

Adapt the command and expected output markers. Choose a help marker that cannot match startup output or input echo. Longer inputs need bounded writes in an existing harness. Require a live child before sending input. After expected output, accept spontaneous exit only with status zero. On Windows, use the existing ConPTY or repository harness instead. Cleanup below supervises the direct child; a CLI that launches descendants needs its existing process-tree harness.

```python
import errno
import os
import pty
import select
import signal
import subprocess
import time
from contextlib import ExitStack

transcript = bytearray()
proc = None
with ExitStack() as fds:
    master_fd, slave_fd = pty.openpty()
    fds.callback(os.close, master_fd)
    fds.callback(lambda: os.close(slave_fd) if slave_fd is not None else None)
    try:
        proc = subprocess.Popen(
            ["<command>", "<arg>"],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
        )
        os.close(slave_fd)
        slave_fd = None

        def wait_for(pattern, phase, timeout):
            start = len(transcript)
            deadline = time.monotonic() + timeout
            while pattern not in transcript[start:]:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError(f"Timed out waiting for {phase}")
                ready, _, _ = select.select([master_fd], [], [], min(0.1, remaining))
                if ready:
                    try:
                        chunk = os.read(master_fd, 4096)
                    except OSError as exc:
                        if exc.errno != errno.EIO:
                            raise
                        chunk = b""  # Linux PTYs can report EOF as EIO.
                    if chunk:
                        transcript.extend(chunk)
                        continue
                code = proc.poll()
                if code is not None:
                    raise ChildProcessError(f"Child exited with {code} before {phase}")
                if ready:
                    raise EOFError(f"PTY EOF before {phase}")
            code = proc.poll()
            if code not in (None, 0):
                raise ChildProcessError(f"Child exited with {code} after {phase}")

        wait_for(b"<ready text>", "readiness", 30)
        code = proc.poll()
        if code is not None:
            raise ChildProcessError(f"Child exited with {code} before help input")
        os.write(master_fd, b"help\n")
        wait_for(b"<expected help text>", "help output", 10)
    finally:
        try:
            if proc is not None:
                accepted_codes = {0}
                if proc.poll() is None:
                    proc.terminate()
                    accepted_codes.add(-signal.SIGTERM)
                try:
                    code = proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    accepted_codes.add(-signal.SIGKILL)
                    code = proc.wait(timeout=3)
                if code not in accepted_codes:
                    raise ChildProcessError(f"Child exited with unexpected status {code}")
        finally:
            print(transcript.decode(errors="replace"))
```

If the CLI needs richer terminal control, use `pty.fork()` or an existing PTY library.

## Profiling Recipes

Profiles explain where time goes. Take a reported before or after number from untraced runs, and vet it with the **benchmark-checklist** skill.

- Startup regression: capture baseline and treatment startup timings under the same machine, env, and command.
- Slow operation: start a CPU profile, perform the operation, stop the profile, and compare top self-time functions.
- Memory leak: force GC if available, take a heap snapshot, perform the operation repeatedly, force GC again, and take another snapshot.
- Hang: capture the screen, active handles/resources, and a stack/CPU sample before interrupting.

## Guardrails

- Prefer deterministic waits over sleeps. If you must sleep, explain why.
- Do not send credentials or destructive commands into a controlled session.
- Keep ad hoc harness files in the operating system temporary directory unless the repo already has a testing/demo harness.
- Do not hard-code paths from another repository. Adapt commands to the current repo's scripts and runtime.
- Supervise a background session with a ready/output timeout and a completion check.
- Clean up only terminal sessions, scratch directories, and inspector processes this run created. Preserve transcripts and requested demo evidence at a named location, then confirm they survive cleanup.
