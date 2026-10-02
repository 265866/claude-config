### Runtime forensics

**You own the diagnosis. Instrument the live process. Don't theorize from source.** The deliverable is a cited diagnosis, not a fix.

1. Capture the live signal on the matching surface via the control skill: a CPU profile for a spinning process, a heap snapshot for a leak, a CDP trace for a visual glitch. A real artifact, not a guess.
2. Reduce the artifact to the smoking gun: the function on the hot path, the retainer chain from the leaked object to a GC root, the loop firing without input. Prefer existing deterministic parsers and choose analysis through [the execution reference](../references/execution.md). Delegate bounded large-artifact analysis when useful (the **principle-guard-the-context-window** skill); substantial independent evidence batches can use native orchestration. Keep the live process/control session under one owner and retain the reduced, artifact-linked finding in the main thread.
3. Prove the mechanism before believing it. Prefer observation and an isolated local reproduction. A diagnosis request does not authorize hotfixing code or mutating a live process. If instrumentation changes runtime state, explain the exact probe and get authorization before running it. Use only a verified control adapter available on the matching surface.
4. Map the finding back to source: file, symbol, the line that allocates or schedules.
5. Report the investigated boundary, evidence obtained, and gaps from unavailable signals or failed analysis partitions. A missing result is not a confirmed diagnosis.

**Reply:** the signal captured, the reduced finding, how you proved the mechanism, the source location, artifact paths. No fix unless asked. Hand back to Bug fix or Perf once the cause is known.
