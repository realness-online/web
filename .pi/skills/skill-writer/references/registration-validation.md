# Registration and Validation

Apply repository registration and quality checks before completion.

## Registration checklist (realness)

1. Create or update `.pi/skills/<name>/SKILL.md`. That folder is the only
   source: `.cursor/skills` and `.claude/skills` are symlinks to it.
2. Frontmatter must be valid YAML (`name`, `description`); quote the
   description if it contains a colon.
3. Add `hidden: true` unless Scott types the skill name himself. The menu holds
   only what he types; every other skill is agent-loaded.
4. Add `metadata.check`: one cheap command that proves the skill works, run from
   the skill folder. A skill with no script points at its spec instead.
5. Write scripts as `.js` with JSDoc, semicolon-free. No Python unless the task
   is Python.
6. Install nothing globally. A skill from the open ecosystem is copied into
   `.pi/skills/`; review it first, as with any dependency.

## Validation checklist

1. Run `npm run check skills` (every skill, spec plus realness checks), or one
   skill with depth gates:

```bash
node .pi/skills/skill-writer/scripts/quick-validate.js .pi/skills/<name> --strict-depth

# Sweep every skill
for d in .pi/skills/*/; do node .pi/skills/skill-writer/scripts/quick-validate.js "$d"; done
```

2. Confirm for authoring/generator skills:

- transformed examples exist in references (happy-path, secure/robust, anti-pattern+fix)
- synthesis depth gates are satisfied
- selected example profile requirements are satisfied and reported

3. Confirm for integration/documentation skills:

- `references/api-surface.md` exists
- `references/common-use-cases.md` exists with sufficient depth
- `references/troubleshooting-workarounds.md` exists with sufficient depth
- `SKILL.md` and `references/*.md` avoid host-specific absolute filesystem paths

4. Confirm evaluation outputs as applicable:

- lightweight qualitative summary (recommended default)
- deeper eval or quantitative summary only if user requested benchmark mode or risk warrants it

5. Reject shallow handoffs that omit required artifacts.

The checks read shape, not these rules. A skill that names the wrong folder or
omits `hidden` still passes, so walk this list by hand.

## Required output

- Registration changes summary
- Validator output
- Evaluation summary status
- Any residual risks or open gaps
