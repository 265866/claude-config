### Perf issue

**You own the measurement story. Plan, review, verify the numbers.** Tie every fix to a measurement. Don't read source instead of measuring.

1. Capture a baseline trace via the matching control skill. The trace explains where the time goes. Take the initial baseline number from separate untraced runs, and vet it, and each later number, with the **benchmark-checklist** skill. Record the target: the user's number, or the point where the complaint no longer reproduces on the baseline workload.
2. `how` to ground hypotheses. Don't claim a perf ceiling without running it first.
   Try the performance mantras in order, from most to least effective. A mantra earns an attempt only when the trace shows its signal. Keep a verified win even when it misses the target, and revert an attempt that is not a verified win. Take a new trace before you judge the next mantra's signal. Stop when the combined result meets the target. If it still misses the target after the last mantra with a signal, report that, with the result and its limiter.
   1. **Don't do it.** Stop work whose result nothing uses, rather than making it cheaper. The trace shows what's slow, never that it's deletable, so this one also needs the `how` pass to show that nothing uses the result.
   2. **Do it, but don't do it again.** Cache repeated work on identical inputs, and name what invalidates the cache.
   3. **Do it less.** Batch small operations that each pay a fixed overhead, or prune the input.
   4. **Do it later.** Defer work until its result is first used.
   5. **Do it when they're not looking.** Move work off the interactive moment, and measure the interactive path, not total work.
   6. **Do it concurrently.** Split independent work across cores or machines. Duplicate a slow request or task (replicas, hedged requests) only when the trace shows the wait dominates and there's headroom.
   7. **Do it cheaper.** Use a better algorithm, an index instead of a scan, or a cheaper implementation.
3. Plan the fix from the trace. Use `architect` for a material unsettled design, not merely a change crossing a function boundary. Choose direct work, small delegation, or bounded work/measure/check cycles through [the execution reference](../references/execution.md). Give delegated attempts exact ownership and the baseline workload; inherit the configured model and effort. Keep experiments on shared measurement resources serial. Review the diff and obtain fresh-context review for non-trivial implementation. Capture a comparable post-fix trace. Judge each attempt from untraced runs that alternate it with the last kept version, which is the original baseline until an attempt is kept, per **benchmark-checklist** question 5. Make those runs print an error count and a work count. The work count counts the results the workload must deliver, such as requests answered or rows written, not internal operations that a change may skip or prune. When a change moves work off the timed path, read the work count after that work finishes, outside the timed region. An attempt is a verified win only when three things hold. Its error count is no higher and its work count no lower than the last kept version's, per questions 4 and 7. Its median gap in the faster direction is a measured difference per question 5. The relevant tests still pass. Take the final post-fix number from untraced runs that alternate the original baseline with the final version, and report the baseline from those runs.
   Apply the **principle-sequence-verifiable-units** skill, verifying each attempt before trying the next.
4. Parse and compare the artifacts (JSON to sqlite, diff). "Inconclusive" or wrong-surface is not a pass. Flag it.
5. Run **Opening a PR** only when creation is explicitly requested or approved, and cite the measurement in its description. Otherwise deliver the verified local result and measurements.

For sustained improvement against a metric rather than a one-off fix, use the Hillclimb playbook (`playbooks/hillclimb.md`).

**Reply:** after anything waiting on the user, lead with whether the recorded target was met and the **benchmark-checklist** verdict. Then give the baseline and post-fix numbers with run count, range, and limiter per **benchmark-checklist**, the delta, and the artifact path.
