---
name: benchmark-checklist
description: "Vet a perf measurement (limiter, tuning, limits, errors, repeatability, relevance, and whether the work happened) before you report or act on it. Use when you run a benchmark or report a speedup or regression you measured."
---

# Benchmark checklist

Use this when you produce a performance number: a PR's before and after, a regression claim, a hillclimb harness, or a library or config choice. [Explain the Number](../principle-explain-the-number/SKILL.md) says why. Answer each question below with evidence from a run, not from a guess about the code. [Tools by OS](#tools-by-os) lists the commands for each step.

For a quick ballpark the user asked for, one run is enough. Still check questions 4 and 7, and say that it is one run. Skip the other questions unless that run looks wrong. A choice between options is never a ballpark.

## Before you run anything

- Write down the claim you expect to make, in the words you would ship ("export is 30% faster at p50 on the 60k-row dataset"). The questions test that sentence.
- Read the measurement script. Note what it times, what it counts, and what it ignores.
- In a read-only task, leave the project's files and data unchanged. Regenerable build output is fine. Saved measurements, such as Criterion baselines under `target/criterion/`, are data. Work in fresh `mktemp -d` directories outside the project, unless In place below applies:
  - **Sides.** Run each side from its own copy, and set up every copy the same way with the project's locked install, such as `uv sync --locked`. Run each side with the lockfile frozen, such as `uv run --locked`. Copy the working tree for the current side, including uncommitted and untracked files but not build output or installed dependencies. Check that the copy matches the project before setup. When `<project>/.git` is a file, as in a linked worktree, leave it out, because Git in the copy can write to the project's repository. Do not copy an environment such as `.venv`, because it can still load the project's code. Take a side at another revision from `git clone --no-checkout <project> <dir>`, then check out the SHA that `git -C <project> rev-parse --verify '<rev>^{commit}'` prints. Resolve it in the project, because the clone's `origin/*` names point at the project's local branches. Make any script change the questions call for, such as question 2's tuning or question 4's error count, in the copies.
  - **In place.** When only one side runs, it needs no change, the project is a Git repository with at least one commit and has no submodules or nested repositories, and, with uv, the project's `.venv` already exists, that side may run in place, or from a copy of only the script that imports the project's code. Otherwise, run it from a copy, as Sides says. A missing `.venv` matters because `uv run --no-sync` creates one in the project that the fingerprint does not see. The in-place or script-only run must write nothing to the project except regenerable build output, run with the lockfile frozen, such as `uv run --project <project> --no-sync`, and point tools that save measurements outside the project. Before and after the run, save this fingerprint to a file outside the project: `( cd <project> && { git diff-index -p --binary HEAD; git ls-files -o --exclude-standard -z | xargs -0 cksum --; } )`. It does not cover ignored paths or a nested repository that the run creates. If the two files differ, diff them to find the changed paths, report those paths, and do not revert them without asking.
  - **Data.** Have each side read the project's input data where it is. Write workload data to a fresh directory for each side, and reset it between runs. If the workload writes to its own input data, copy that data there first. Point tools that save measurements, such as `CRITERION_HOME`, at one directory under the evidence directory that every side shares, and name each side's results, such as Criterion's `--save-baseline <side>`.
  - **Filesystem.** On Linux, check `findmnt -no FSTYPE -T "${TMPDIR:-/tmp}"`. When it prints `tmpfs` and neither `findmnt -no FSTYPE -T <project>` nor `findmnt -no FSTYPE -T /var/tmp` prints `tmpfs`, create the copy and workload directories with `mktemp -d /var/tmp/bench.XXXXXXXX`. When they still sit on a different kind of filesystem from the project, as on Windows with a project on a Dev Drive, say in the report which filesystem the workload wrote to.
  - **Evidence and cleanup.** Keep reports and profiles in an evidence directory outside the project. Remove the copies and workload directories when the measurement is done, and report what you installed and removed, per rules/toolchains.md.
  - **Gaps.** When the project has an npm or yarn lockfile, which rules/toolchains.md says to ask about, and the side cannot run in place, ask the user. Without a lockfile, record the versions each side resolved. When a side cannot be set up or changed this way, or its versions differ in a way the change did not make, say so. Treat that side as untuned under question 2, the question the change serves as unchecked, or the side as one that could not be measured. Name each one as a gap. The Report section says which make the verdict inconclusive.
- Check the machine's load and core count. If the machine is busy, find out what is running. Stop only processes this run started. Otherwise, interleave the sides so both see the same noise, and say so in the report.

## The questions

1. **Why not double?** Name the limiter. Profile in a run you do not report, because profilers and tracers slow the work down. Look at CPU per process, a profiler for the runtime, I/O wait, and syscall counts where the OS offers them. Then map the hot spot to source. Watch the load generator too. If it saturates first, you measured the load generator. If a change did not move the number, the limiter explains why, so find it before you call the change useless.
2. **Was it tuned?** Run every side the way production runs it: release builds, production flags and env, batching and transaction settings, connection pools, caches as warm or cold as production sees them, and the same versions and data. If one side runs on defaults, you compared configurations, not implementations. A limiter that is a setting, such as a commit per row, a debug build, or a missing index, means that side is untuned. Tune it and measure again before you pick a winner. If you cannot tune it, do not pick a winner from that run. Narrowing the claim to the code as it ships today does not fix this when the user is choosing what to adopt, because they adopt the option, not today's settings.
3. **Did it break limits?** Do the arithmetic. Compare bytes per second with disk and network bandwidth, and operations per second times the cost per operation with the cores you have. Compare the time saved with the time the changed piece took. Removing a piece that takes 10% of the run can make the run at most about 11% faster. A result past a limit means the run measured something other than the work, such as a cache that production would not have, a no-op, or a bug.
4. **Did it error?** Count failures, non-success responses, and outputs that fail a correctness check as errors. Check that the outputs are correct, not just present. Errors behave differently from successes. Rejections are often fast, and timeouts and retries are slow. If the script does not count errors, add the count. In a read-only task, add it the way [Before you run anything](#before-you-run-anything) says.
5. **Does it reproduce?** Run each side at least 5 times, and alternate the sides (A, B, A, B, and so on) so that warmup, lazy initialization, caches, and drift do not favor one side. Report the median and the range. With only one side, run it at least 5 times and report its median and range. Treat a gap smaller than both sides' ranges as no measurable difference, and a gap larger than both as a measured difference. When the gap falls between the two ranges, or one run is an outlier, decide with a rank-sum test or the harness's own statistics.
6. **Does it matter?** Next to any micro result, measure the end-to-end path a user waits on, with realistic data sizes and concurrency. Report the micro result as a share of the whole. A helper that takes 1% of a request can make the request at most 1% faster, however fast the helper gets.
7. **Did it even happen?** Confirm the results the workload must deliver were delivered. The requests were answered, the rows were written, and the code used the result. Results on the timed path come from inside the timed region. Results a change deliberately moves off that path count once they finish. Internal work that a change skips, prunes, or defers, or caches the way production would per question 2, is not missing work. Lazy code (generators nobody iterates, promises nobody awaits, results the JIT can discard) and timeouts all produce numbers for work that never happened.

## Report

- After anything waiting on the user, lead with the verdict: faster, slower, no measurable difference, or inconclusive. A playbook reply that tracks a target puts whether the target was met first, then the verdict. A measurement that compares nothing, such as a single throughput, or a requested ballpark leads with its number or numbers instead, labeled inconclusive when a condition below applies.
- A requested ballpark gives its number with its unit, labeled as one run. It skips the range and the limiter, and a missing limiter does not make it inconclusive. A ballpark that compares two sides gives each side's number, each labeled as one run, and no faster or slower verdict.
- Otherwise, give the number with its unit, the run count, each side's range, and the limiter. For example, "p50 went from 41 ms to 33 ms, median of 7 runs per side, range 39 to 44 ms before and 32 to 35 ms after, bound by JSON parsing on one core."
- Call the verdict, or a number that compares nothing, inconclusive when you cannot name the limiter (a requested ballpark excepted), when a side ran untuned or could not be measured, or when you could not check question 4 or question 7. Name the gap.
- In a PR body, give one primary number where it says how the change was checked, per the [Opening a PR](${CLAUDE_SKILL_DIR}/../../playbooks/opening-a-pr.md) playbook. Put the runs, the range, and the limiter evidence in an artifact a reviewer can reach, which the PR body links.

## Tools by OS

Write each profile or report to an evidence directory: the task's run directory when the result is evidence (outside the project in a read-only task), or a directory from `mktemp -d` for a throwaway run. Never write one loose in the working directory. A tool that needs admin or root runs in an agent shell only without a password or UAC prompt: through `sudo -n`, as uid 0, or from a Windows shell that is already elevated. Treat a prompt or an elevation failure as missing access, per [rules/toolchains.md](${CLAUDE_SKILL_DIR}/../../rules/toolchains.md). Then use the next option, or report the gap.

**Linux**

- Core count: `nproc`
- Load: `uptime`
- What is running, CPU per process: `top -b -n 1 -o %CPU`, or `pidstat 1 5`
- I/O wait: `vmstat 1 5`, and read the `wa` column
- Native sampling profile: `perf record -g -o <evidence-dir>/perf.data -- <command>`. Debian sets `perf_event_paranoid` to 3, so perf needs root there.
- Syscall counts: `strace -c -f <command>`. Tracing your own child process needs no root.

`pidstat`, `perf`, and `strace` are often not installed. They come from the `sysstat`, `strace`, and `linux-perf` packages on Debian, or `perf` on Fedora. Installing them needs root. Follow [rules/toolchains.md](${CLAUDE_SKILL_DIR}/../../rules/toolchains.md), and report each install by name.

**macOS**

- Core count: `sysctl -n hw.logicalcpu`
- Load: `uptime`
- What is running, CPU per process: `top -l 2 -o cpu -n 10 -stats pid,command,cpu,time,mem`, and read the second sample
- Disk throughput: `iostat -w 1 -c 5`. macOS reports no I/O wait.
- Native sampling profile: `sample <pid> 10 -file <evidence-dir>/sample.txt` on a running process you own. Without `-file`, it also leaves a report in `/tmp`.
- Syscall counts: not available without root and System Integrity Protection changes

**Windows (PowerShell)**

- Core count: `[Environment]::ProcessorCount`
- Load: `Get-Counter '\System\Processor Queue Length','\Processor(_Total)\% Processor Time'`
- What is running, CPU per process: `Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object Name -notin '_Total','Idle' | Sort-Object PercentProcessorTime -Descending | Select-Object -First 10 Name,IDProcess,PercentProcessorTime`. The value is percent of one core. `Get-Process` sorts by lifetime CPU time, so it does not show what is busy now.
- Disk: `Get-Counter '\PhysicalDisk(_Total)\% Idle Time' -SampleInterval 1 -MaxSamples 5`. Windows reports no I/O wait.
- Native sampling profile: Windows Performance Recorder (`wpr`), which needs admin
- Syscall counts: not built in

Runtime profilers need no root, with one exception, py-spy on macOS:

- JavaScript: `node --cpu-prof --cpu-prof-dir=<evidence-dir>` or `bun --cpu-prof --cpu-prof-dir=<evidence-dir>`
- Python: `uv tool run py-spy record --subprocesses -o <evidence-dir>/profile.svg -- uv run --locked python <script>`. On macOS, use `uv run --locked python -m cProfile -o <evidence-dir>/profile.prof <script>` instead. In a read-only task run in place or from a copy of only the script, replace `uv run --locked` with `uv run --project <project> --no-sync`, per [Before you run anything](#before-you-run-anything).
- Go: `go test -cpuprofile <evidence-dir>/cpu.out -o <evidence-dir>/pkg.test`, then `go tool pprof`

Compiled languages without a runtime profiler, such as Rust, use the native sampling profile.

## How this fits the other perf material

- The [Perf issue](${CLAUDE_SKILL_DIR}/../../playbooks/perf-issue.md) playbook finds and fixes slowness, and the performance mantras in its step 2 generate the fixes. This skill vets its baseline before the playbook plans from it, and every number after that.
- The [Hillclimb](${CLAUDE_SKILL_DIR}/../../playbooks/hillclimb.md) playbook loops on one metric. For a perf metric, this skill vets its harness before the harness is frozen. The frozen harness then prints error counts and work counts of delivered results, so each keep-or-revert checks questions 4 and 7 for free. Its alternating runs, at least 5 per side with each run's value, the median, and the range, cover question 5.
