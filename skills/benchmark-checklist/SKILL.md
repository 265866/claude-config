---
name: benchmark-checklist
description: "Vet a perf measurement (limiter, tuning, limits, errors, repeatability, relevance, and whether the work happened) before you report or act on it. Use when you run a benchmark or report a speedup or regression you measured."
---

# Benchmark checklist

Use this when you produce a performance number: a PR's before and after, a regression claim, a hillclimb harness, or a library or config choice. [Explain the Number](../principle-explain-the-number/SKILL.md) says why. Answer each question below with evidence from a run, not from a guess about the code. [Tools by OS](#tools-by-os) lists the commands for each step.

For a quick ballpark the user asked for, one run is enough. Still check questions 4 and 7, and say that it is one run. Skip the rest unless that run looks wrong. A choice between options is never a ballpark.

## Before you run anything

- Write down the claim you expect to make, in the words you would ship ("export is 30% faster at p50 on the 60k-row dataset"). The questions test that sentence.
- Read the measurement script. Note what it times, what it counts, and what it ignores.
- Check the machine's load and core count. If the machine is busy, find out what is running. If you cannot stop it, interleave the sides so both see the same noise, and say so in the report.

## The questions

1. **Why not double?** Name the limiter. Profile in a run you do not report, because profilers and tracers slow the work down. Look at CPU per process, a profiler for the runtime, I/O wait, and syscall counts where the OS offers them. Then map the hot spot to source. Watch the load generator too. If it saturates first, you measured the load generator. If a change did not move the number, the limiter explains why, so find it before you call the change useless.
2. **Was it tuned?** Run every side the way production runs it: release builds, production flags and env, batching and transaction settings, connection pools, caches as warm or cold as production sees them, and the same versions and data. If one side runs on defaults, you compared configurations, not implementations. A limiter that is a setting, such as a commit per row, a debug build, or a missing index, means that side is untuned. Tune it and measure again before you pick a winner. If you cannot tune it, do not pick a winner from that run. Narrowing the claim to the code as it ships today does not fix this when the user is choosing what to adopt, because they adopt the option, not today's settings.
3. **Did it break limits?** Do the arithmetic. Compare bytes per second with disk and network bandwidth, and operations per second times the cost per operation with the cores you have. Compare the time saved with the time the changed piece took. Removing a piece that takes 10% of the run can make the run at most about 11% faster. A result past a limit means the run measured something other than the work, such as a cache, a no-op, or a bug.
4. **Did it error?** Count failures and non-success responses, and check that the outputs are correct, not just present. Errors behave differently from successes. Rejections are often fast, and timeouts and retries are slow. If the script does not count errors, add the count.
5. **Does it reproduce?** Run each side at least 5 times, and alternate the sides (A, B, A, B, and so on) so that warmup, lazy initialization, caches, and drift do not favor one side. Report the median and the range. Treat a gap smaller than the run-to-run variation as no measurable difference. When the call is close, use a rank-sum test or the harness's own statistics.
6. **Does it matter?** Next to any micro result, measure the end-to-end path a user waits on, with realistic data sizes and concurrency. Report the micro result as a share of the whole. A helper that takes 1% of a request can make the request at most 1% faster, however fast the helper gets.
7. **Did it even happen?** Confirm the work ran inside the timed region. The request reached the server, the rows were written, the bytes were read, and the code used the result. Lazy code (generators nobody iterates, promises nobody awaits, results the JIT can discard) and timeouts all produce numbers for work that never happened.

## Report

- Lead with the verdict: faster, slower, no measurable difference, or inconclusive.
- Give the number with its unit, the run count, the range, and the limiter. For example, "p50 41 ms → 33 ms, median of 7 runs per side, range 32 to 35 ms after, bound by JSON parsing on one core."
- Call the verdict inconclusive when you claim a difference but cannot name the limiter, when a side ran untuned, or when you could not check questions 4 and 7. Name the gap.
- Keep a PR body to one primary number, per the [Opening a PR](../../playbooks/opening-a-pr.md) playbook. Put the runs, the range, and the limiter evidence in a linked artifact or a notes file.

## Tools by OS

A tool that needs admin or root fails in a non-interactive agent shell. Use the next option, or report the gap.

**Linux**

- Core count: `nproc`
- Load: `uptime`
- What is running, CPU per process: `top -b -n 1 -o %CPU`, or `pidstat 1 5`
- I/O wait: `vmstat 1 5`, and read the `wa` column
- Native sampling profile: `perf record -g -- <command>`. Debian sets `perf_event_paranoid` to 3, so perf needs root there.
- Syscall counts: `strace -c -f <command>`. Tracing your own child process needs no root.

`pidstat`, `perf`, and `strace` are often not installed. They come from the `sysstat`, `strace`, and `linux-perf` packages on Debian, or `perf` on Fedora. Installing them needs root, per the profile's toolchain rules.

**macOS**

- Core count: `sysctl -n hw.logicalcpu`
- Load: `uptime`
- What is running, CPU per process: `top -l 2 -o cpu -n 10 -stats pid,command,cpu,time,mem`, and read the second sample
- Disk throughput: `iostat -w 1 -c 5`. macOS reports no I/O wait.
- Native sampling profile: `sample <pid> 10 -file <tmpdir>/sample.txt` on a running process you own. Without `-file`, it also leaves a report in `/tmp`.
- Syscall counts: not available without root and System Integrity Protection changes

**Windows (PowerShell)**

- Core count: `[Environment]::ProcessorCount`
- Load: `Get-Counter '\System\Processor Queue Length','\Processor(_Total)\% Processor Time'`
- What is running, CPU per process: `Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object Name -notin '_Total','Idle' | Sort-Object PercentProcessorTime -Descending | Select-Object -First 10 Name,IDProcess,PercentProcessorTime`. The value is percent of one core. `Get-Process` sorts by lifetime CPU time, so it does not show what is busy now.
- Disk: `Get-Counter '\PhysicalDisk(_Total)\% Idle Time' -SampleInterval 1 -MaxSamples 5`. Windows reports no I/O wait.
- Native sampling profile: Windows Performance Recorder (`wpr`), which needs admin
- Syscall counts: not built in

Runtime profilers need no root, with one exception, py-spy on macOS:

- JavaScript: `node --cpu-prof` or `bun --cpu-prof`
- Python: `uv tool run py-spy record --subprocesses -o <file> -- uv run python <script>`. On macOS, use `uv run python -m cProfile -o <file> <script>` instead.
- Go: `go test -cpuprofile <file>`, then `go tool pprof`

Compiled languages without a runtime profiler, such as Rust, use the native sampling profile.

## How this fits the other perf material

- The [Perf issue](../../playbooks/perf-issue.md) playbook finds and fixes slowness, and the performance mantras in its step 2 generate the fixes. This skill vets its baseline before the playbook plans from it, and every number after that.
- The [Hillclimb](../../playbooks/hillclimb.md) playbook loops on one metric. This skill vets its harness before the harness is frozen. The frozen harness then prints error and work counts, so each keep-or-revert checks questions 4 and 7 for free.
