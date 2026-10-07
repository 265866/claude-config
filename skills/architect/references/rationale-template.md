# Rationale template

The prose that accompanies the type sketch. One page. Sentence-case headings, no boilerplate. Replace the italic notes with actual content.

## Problem

*One paragraph. What we're trying to do, and what about the existing system or constraints makes the shape non-obvious. If [Phase A](../SKILL.md#phase-a-ground-the-problem) surfaced constraints the design must honor (existing types to interop with, callers we can't break, invariants that crossed our boundary), name them here so the reader sees the same constraints you saw.*

## Usage (caller's view)

*Write this first, before the type sketch. Show the README or quickstart the consumer reads, plus two or three realistic call sites in their own code. What they import, what they call, what comes back. The type sketch in [Shape](#shape) is derived from this. The two must agree. When they diverge, reconcile the sketch to the usage, not the reverse. The caller's experience is the spec. The types serve it.*

## Shape

*The recommended architecture. Data structures first. Then how data flows through the signatures. Name the load-bearing decisions. State which invariants are encoded in types, where validation lives, and what the system deliberately does not do. Judge interface depth explicitly. State what complexity the public surface hides, what remains exposed to callers, and why the interface is no larger than needed. Cite the principle behind each decision (e.g., `per boundary-discipline`). Don't restate it.*

## Synthesis decision

*Filled in by the coordinator. When an [arena](../../arena/SKILL.md) comparison ran, because it was warranted or because the user explicitly asked for one, record which candidate became the base and why, what was adapted from each other candidate, and what was rejected and why. When it ran only at the user's request, also record the request and the constraints that made comparison look unnecessary. For a settled design with no comparison, name the accepted constraints or existing decision that made comparison unnecessary.*

## Tradeoffs accepted

*One bullet per tradeoff the chosen shape makes. Form: "we accept X in exchange for Y." Name anything a future reader might mistake for an oversight, including things that look like premature optimization or premature simplification.*

## Alternatives considered

*Name the concrete alternatives actually considered, with a line on why each lost. Judge meaningful alternatives on interface depth and the complexity they expose or hide. Include several when the design space had real contenders. When an approved design or established pattern already settles the shape, record that constraint instead of inventing a rival. This section covers alternatives considered within the design, not a duplicate inventory of other runner candidates.*

## Open questions and risks

*Things you noticed during the sketch that the human needs to weigh in on, and risks worth flagging before implementation starts. Phrase as questions, not assertions, so the human's answer is the resolution rather than a comment.*

## Next implementation step

*The first thing to build against the sketch. One sentence. What you'd start writing immediately after synthesis (or after Phase C sign-off, if a checkpoint was opted into).*
