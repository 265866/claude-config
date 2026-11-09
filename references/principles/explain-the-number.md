# Explain the Number

Apply when you are about to measure, or to trust, report, or act on a number you measured, such as a speedup, a regression, a throughput, a latency, or an eval result.

A measured number is a claim about a system. Before you trust it, report it, or act on it, rule out that it measured something else. For a performance number, also find what limits it.

**Why:** A run that went wrong still prints a plausible number. Requests that failed, a cache that skipped the work, code that never ran, a side left on default settings, and run-to-run noise all produce results that look fine. If you cannot say why a performance number is not twice as good, you do not know what you measured.

**Pattern:**

- **Write the decision before you run.** Name the result that would change a decision, and the noise floor. When the run-to-run spread is larger than the effect you named, report no measurable difference instead of adding runs to chase it. The benchmark-checklist skill decides borderline gaps.
- **For a performance number, ask "why not double?"** Name the resource or code path that bounds the result, such as a core, a lock, the disk, the network, or the load generator itself. Get it from a profile or system counters taken in a run you do not report, then map it to source. A guess from reading the code is not a limiter.
- **List what else the number could be measuring, and rule out each one with evidence.** The usual suspects are errors, skipped results, results served from a cache that production would not have, an untuned side, noise, and a piece too small to matter end to end.
- **Keep the evidence with the number.** Put the run count, the range, and, for a performance number, the limiter in the notes or a linked artifact, so a reader can check the claim.

For a performance number, run the full procedure with the [benchmark-checklist](../../skills/benchmark-checklist/SKILL.md) skill. For an eval result, ask the same of the trials: did every run do the task, does the gap hold across trials (and across models only when the user asked for a model comparison), and does the scenario matter. An eval result needs no named limiter.

You skipped this when a run started without naming the result that would change a decision, when the evidence behind a number has no run count or no range, when a performance number has no named limiter and is not labeled inconclusive, or when the time saved is larger than the time the changed piece took. A ballpark the user asked for, labeled as one run, needs no named decision, no range, and no limiter.

Distinct from [Prove It Works](prove-it-works.md), which checks that an output is real. This checks that a measured number means what you say it means.
