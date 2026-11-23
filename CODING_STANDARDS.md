# Coding standards

## Skills

- One folder per skill: `SKILL.md`, optional `scripts/` and `references/`.
- Frontmatter has `name` (matches the folder), `description` and `disable-model-invocation: true`.
- Steps are numbered `##` headings. Each step ends with a `Done when …` line that states a checkable exit condition.
- Link references with relative paths, and tell the agent when to read them ("Read this when …").
- Use the terms in [GLOSSARY.md](GLOSSARY.md). Never use a term from an `_Avoid_` list.
- Each skill is self-contained. Don't link to another skill's files; copy what you need and say it's a copy.
- The README lists every engineering skill with one paragraph on when to pick it.

## Scripts

- Plain JavaScript. Node scripts are `.mjs` ES modules; scripts injected into a page are `.js` function expressions.
- No comments that restate the code. Keep only those that explain a constraint the code can't express.
- Delete removed code outright. No commented-out code, no `_unused` names.
- Wait with bounds: every wait has a timeout.
- A script that judges pass/fail exits non-zero on any failure.
- Pin dependencies in the skill's own `package.json` and commit `package-lock.json`.
