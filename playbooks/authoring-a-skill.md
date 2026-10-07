### Authoring or modifying a skill

**You own the skill's voice.**

1. Use the **author-skill** skill (the bundled authoring guidance for SKILL.md files).
2. Validate the skill: frontmatter has `name` and `description`, referenced files exist, cross-skill links resolve.
3. Validate decisions with a realistic task when the change affects routing, tools, resources, or workflow boundaries. A grammar-only edit needs direct verification rather than a simulated task.
4. Deliver the verified local result. Run **Opening a PR** only when PR creation is explicitly requested or approved.

When in doubt, delete. Keep prose that changes a decision and explain a rule when its reason prevents misuse. Match tone to scope. Point at structural sources (types, READMEs, config) per the **principle-encode-lessons-in-structure** skill. Reference other skills by path rather than restating them. Put domain procedure and acceptance in the skill, and share execution mechanics through [the execution reference](../references/execution.md). A repeated procedure may justify a new skill or a saved native workflow. Propose one on your own initiative only after demonstrated repetition, and change the personal profile only under an authorized profile-maintenance request; a user's explicit request for a personal skill or saved workflow is one. One-off workflow scripts remain task run artifacts.

**Reply:** summary of the skill, key design decisions, validation notes.
