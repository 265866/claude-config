# Build the Lever

Apply when a repeated transformation or a fragile verification could run as a deterministic codemod, script, generator, or procedure.

Use a deterministic tool when it makes repeated work or fragile proof more reliable. Prefer the project's existing commands before writing a new tool.

**Why:** Two payoffs. Throughput: a codemod, generator, or script does the work the same way every time and can rerun without repeating the manual edits. Confidence: the tool is one artifact a reviewer can read and rerun to check the work. Hand-done changes can only be re-verified by redoing them. A deterministic script turns "trust me" into "run this".

**Pattern:** Choose a tool when there is a repeatable transformation, a measurement that needs reproducibility, or a check whose manual repetition is error-prone. A substantial one-off question can still be answered directly from evidence.

- Do the first unit by hand to learn the recipe, then build the tool. Prove it by rerunning it on that unit and diffing against your hand-done version. Make the lever safe to rerun.
- Codemod or script for edits, generator for repetitive files, a dump-to-sqlite query for analysis, a rerunnable check for verification.
- A deterministic lever beats fan-out. If the tool can process every unit in one pass, run it yourself. Don't fan out delegates to hand-apply what a script can do.
- When delegating repeated work, reuse the applicable skill or provide one shared recipe, verification contract, and ownership boundary in the run's worker briefs. Keep the contract outside workers' write ownership. Creating a new installed skill is not a prerequisite for delegation.
- A native Workflow script coordinates reasoning and checks; it is not a deterministic transformation merely because its orchestration is code. Use the execution method selected by the coordinator.
- Commit the lever when the work outlives the session.

**Balance:** Tool creation must earn its cost without expanding the task. Read-only investigations do not require writing a file, and ordinary tasks do not authorize modifying the installed profile. Per [Subtract First](subtract-first.md), build the smallest tool that covers a real need.

Distinct from [Encode Lessons in Structure](encode-lessons-in-structure.md), which makes a recurring instruction a durable guardrail. This is throughput and reviewability on the work in front of you. For scripting the verification itself, see [Prove It Works](prove-it-works.md).
