### Perf issue

**You own the measurement story. Plan, review, verify the numbers.** Tie every fix to a measurement. Don't read source instead of measuring.

1. Capture a baseline trace via the matching control skill. Vet the baseline, and each later number, with the **benchmark-checklist** skill.
2. `how` to ground hypotheses. Don't claim a perf ceiling without running it first.
   Try the performance mantras in order, cheapest first. A mantra earns an attempt only when the trace or the `how` pass shows its signal. When an earlier mantra meets the target, stop.
   1. **Don't do it.** Stop work whose result nothing uses, rather than making it cheaper. The trace shows what's slow, never that it's deletable, so this one needs the `how` pass.
   2. **Do it, but don't do it again.** Cache repeated work on identical inputs, and name what invalidates the cache.
   3. **Do it less.** Batch small operations that each pay a fixed overhead, or prune the input.
   4. **Do it later.** Defer work until its result is first used.
   5. **Do it when they're not looking.** Move work off the interactive moment, and measure the interactive path, not total work.
   6. **Do it concurrently.** Split independent work across cores or machines. Duplicate a slow attempt only when the trace shows the wait dominates and there's headroom.
   7. **Do it cheaper.** Use a better algorithm, an index instead of a scan, or a cheaper implementation.
3. Plan the fix from the trace. Use `architect` for a material unsettled design, not merely a change crossing a function boundary. Choose direct work, small delegation, or bounded work/measure/check cycles through [the execution reference](../references/execution.md). Give delegated attempts exact ownership and the baseline workload; inherit the configured model and effort. Keep experiments on shared measurement resources serial. Review the diff and obtain fresh-context review for non-trivial implementation. Capture a comparable post-fix trace.
   Apply the **principle-sequence-verifiable-units** skill, verifying each attempt before trying the next.
4. Parse and compare the artifacts (JSON to sqlite, diff). "Inconclusive" or wrong-surface is not a pass. Flag it.
5. Run **Opening a PR** only when creation is explicitly requested or approved, and cite the measurement in its description. Otherwise deliver the verified local result and measurements.

For sustained improvement against a metric rather than a one-off fix, use the Hillclimb playbook (`playbooks/hillclimb.md`).

**Reply:** baseline number, post-fix number, delta, artifact path.
