### Eval

**You own the experiment design. Plan, blind, run, synthesize.**

**Non-negotiables for blinding:**

- Hide experiment labels, instructions describing the comparison, and names, slugs, or metadata created specifically for the comparison from candidates. Preserve legitimate existing project/profile context, including tests, skill names, and rubric-like domain files.
- The candidate prompt looks like an organic user request. State the goal, not the meta.
- No chain-eliciting cues. Don't ask the candidate to list which skills, principles, or files they applied. Ask for design notes generally and grade chain-following from code shape, not self-report.
- Use project-shaped names for directories and slugs created for the comparison.
- Don't tell the candidate other candidates exist.
- The judge can know it's judging but sees outputs by sanitized label only, never by model name.
- Comparing two variants: one judge scores both sets in a single pass on one scale, blind to which set each came from.

**Steps:**

1. **Frame.** State what variant is under test and what behavior counts as success. Write the comparison rubric (3-6 concrete criteria) for the judge only. Hold it back from candidates.
2. **Set up sanitized environments.** Per-candidate working dir with the variant in place. Plant any context an organic task would have: a project skeleton, the skills the candidate would naturally read. Verify the runner actually loads the intended variant without inherited instructions contaminating the comparison. Use supported isolation and resolved paths; do not invent a working-directory or profile override on the workflow agent API. If the runner cannot establish the variant boundary, report that constraint before running candidates.
3. **Author one organic prompt.** What a user would type. Do not disclose the assigned comparison or variant identities.
4. **Run the candidate batch** in independent fresh contexts per the **arena** skill's candidate phase. Set the count before launch. Retry a candidate per arena Phase B, at most once and only after inspection finds a recoverable cause. A retried candidate starts in a fresh copy of its sanitized directory with the same prompt and named direction, if any, plus every later directive sent to all candidates or to the failed candidate, without the failed candidate's partial artifacts or report. Directives given only to you stay out of the retry, so every candidate works from the same prompt. Choose execution through [the execution reference](../references/execution.md): native independent batches with a dependent judging phase fit substantial experiments; small comparisons can use ordinary delegation. Each candidate works in its own sanitized directory with the same prompt (plus any named direction the frame assigns, as arena allows) and inherited configured model and effort. Distinct contexts and approaches provide diversity; do not claim different model families. A model comparison runs only when the user requested it, and only with verified supported models.
5. **Run one blinded judge** in a separate fresh context with a distinct review lens per the **arena** skill's judging phase. Judge sees outputs by sanitized label and the rubric, never a model name. Preserve failed, stopped, and missing candidates as coverage gaps; do not discard them and report a complete comparison. Keep live UI or other shared-resource checks under one owner.
6. **Verify the chain from artifacts, not self-report.** Read only the experiment's scoped native session/subagent transcripts under the resolved profile root, or its exported tool trace. Follow the Session pickup playbook for actual paths. Do not glob across unrelated project histories. Use observed file reads and code shape to assess whether the intended instructions took effect; mark missing trace evidence as unverified.
7. **Read every candidate output yourself** end to end. Compare to the judge's verdict. Investigate disagreement for bias or an ambiguous rubric. Read both rationales before deciding. Synthesize.

**Reply:** variant under test, rubric, per-candidate notes, judge's verdict, your synthesis, and a recommendation for whether to promote the variant.
