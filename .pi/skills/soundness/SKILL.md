---
name: soundness
description:
  Read first, before generating any asset (site, page, component, style,
  script, or architecture). Every feature starts as structural HTML with
  Schema.org microdata; CSS and JavaScript layer on top. realness sets the
  colors, type, and spacing. Use for writing, refactoring, and reviewing code in
  any project. Covers itemid-addressed pages, Realness light/dark styling,
  and Progressive Web App build and browser checks. Defer motion to
  motion-systems and client type voice to typography.
metadata:
  check: "node ../../bin/checks/check-skills.js soundness"
  category: Design & Frontend
  tags:
    - architecture
    - javascript
    - css
    - design-system
    - code-review
---

# Useless

How we design and write production-quality software. Load it before the work,
not after. Rules here are non-negotiable; specialist skills add language and
domain details.

`planning` owns work order and approval gates. This skill owns solution
structure and implementation quality. Baseline naming and syntax live in
AGENTS.md.

## How to use this skill

- Read this file first. Load a reference only when its section points to it.
- Run "Before you write" for any design or code change.
- Run "Before you call done" before reporting work complete.
- Do not wait for a cleanup request. Quality is part of the first pass.

## Before you write

1. Read the existing code and the project's tooling before choosing a design.
2. Trace inputs, state, outputs, ownership, and trust boundaries.
3. Use platform features before custom machinery or a new dependency.
4. Split modules by responsibility; keep entry points small.
5. Share source modules. Never generate copies or rewrite source strings.
6. Keep CSS and browser JavaScript in normal files; HTML in focused templates.
7. Declare dependencies and commands in the project's package manifest; use the
   lockfile; leave dependency changes for human review.
8. Preserve existing behavior and interfaces unless a change is approved.
9. Decide how you will verify through the real entry point, not internals.
10. State the plan in a short message when the change is non-trivial. Do not
    start a multi-step build without a checkpoint.

## Rules

### Readable implementation

- Use `const` arrow functions for functions, exported ones included. No
  `function` keyword. Use object-literal methods for returned APIs; keep
  standalone utilities separate.
- Rename imported bindings to snake_case: `import { readFile as read_file }`.
  Single-word names already fit. A name a template or declaration needs keeps
  its required casing.
- Keep methods safe when passed as callbacks; avoid unnecessary `this` coupling.
- Minimize inline comments. Move a non-obvious rule or reason into short JSDoc
  on the function or shape; delete comments that restate the code. JSDoc carries
  public inputs, shared shapes, and the why. Leave obvious locals unannotated.
  Keep type syntax out of JavaScript.
- Use the configured root imports: `@/` with supporting build tools, `#root/`
  in Node. Define Node aliases in package.json; use resolvable URLs in browser
  modules.
- Use native CSS nesting. A descendant rule belongs inside its parent block;
  a top-level selector that repeats a parent already declared above it is a
  miss. Keep `@media` and `@keyframes` at the top level.
- Preserve selector specificity and behavior when nesting.
- Escape text at output boundaries. Keep trusted author HTML separate from plain
  text, and test quotes and markup in text fields.
- Treat editor inlay hints as a display setting, not a source change.

Example: [references/examples/readable-renderer.md](references/examples/readable-renderer.md).

### Semantic selectors, not invented ones

Write every selector against something real - an element, native state,
microdata, or ARIA. Never invent a class or `data-*` for something that already
has an honest attribute. Walk the decision order and stop at the first honest
fit. Full order, `data-*` test, and the class carve-out:
[references/selectors.md](references/selectors.md).

### No invented wrappers

A node that exists only so CSS or JS can target "this group" is usually the
wrong shape. Prefer no wrapper, a real element, or the attribute you already
need. Full decision list and smell table:
[references/wrappers.md](references/wrappers.md).

### Markup as the data model

One markup decision pays seven times. `itemid`, `itemprop`, and `itemtype` are
the same identifiers the stylesheet selects on, the layout reads with `:has()`,
the data layer parses, the app holds state in, the storage path is built from,
and the database lists. Write the element once and every layer knows what it
means. Choose the element whose native semantics match the data.

### Addressed items and generated sites

Give each addressed item an `itemid`, `itemscope`, and a Schema.org `itemtype`.
Read [references/items-and-pwa.md](references/items-and-pwa.md) before building
an item, page, or site. It defines minting, source/rendered identity, references,
and the Realness Progressive Web App (PWA) requirements.

Keep the source's itemid in its rendered HTML. Save rendered items at their
itemid paths and keep public slugs. Use the shared itemid package; declare the
app's vocabulary. Do not invent IDs or use file timestamps to reconstruct them.

Build first, then check the shipped directory:

```
node .pi/bin/checks/soundness-check.js --site <built-directory>
# For a build with a different worker filename:
node .pi/bin/checks/soundness-check.js --site <built-directory> --worker sw.js
```

This gate checks item markup, linked Realness palette and color roles, light/dark
wiring, and PWA file structure. It does not prove appearance, installability,
offline operation, or safe updates. Verify those in a browser before completion.
Do not replace the built-site gate with a source scan.

### Markup over map()

For a small, fixed set of items whose content differs in shape, write each one
out as its own HTML block instead of a `v-for` or `.map()`. A reader sees what
renders instead of executing a loop. A genuinely uniform or open-ended list
still belongs in a loop.

### Spacing: one unit, two axes

Pick one spacing unit; derive every margin, gap, and padding from it. Vertical
measurements are whole multiples. Horizontal small values may be fractions; big
horizontal numbers (measure, gate, limit) come from a small named set, never a
fresh magic number. Use realness's `--base-line` and named widths. Full argument:
[references/spacing.md](references/spacing.md).

### Type: fluid modular scale

Two ratios, two viewport thresholds, every size a `clamp()` over a slope
`calc()`. No media-query jumps. Recipe, ratio math, and the below-body-size
bound-order gotcha: [references/TYPE_SCALE_RECIPE.md](references/TYPE_SCALE_RECIPE.md).
Use realness's ratios and thresholds.

### Color: materials and roles

Name swatches after materials, not hues. Components reference roles; a role
points at a material. A rebrand or dark-mode retune changes the role map, not a
hundred call sites. Full growth rules and a worked example:
[references/COLOR_RECIPE.md](references/COLOR_RECIPE.md).

### Dark mode

`prefers-color-scheme` only. No JS, no class toggle. A role's light and dark
values live in the same declaration, one media query apart.

### Links

Prose links get a visible affordance beyond color; bare UI links do not. realness
uses an accent -> emphasis hover and a subtle bottom border inside prose.

### HTML attributes as application state

Prefer native state - `open`, `disabled`, `checked`, `hidden`, `:has()`,
`:checked`, `[open]` - over JS-managed classes. Prefer `<details>`/`<summary>`
for disclosure, `<dialog>` for modals, a checkbox for toggles.

### Custom reset

No off-the-shelf reset or normalize. Write a reset for the elements the project
actually uses. The reset is the precondition for the baseline grid: margins only
line up if every element starts from zero.

### Cascade over scoping

No Vue `scoped` styles and no `<Transition>`/`<TransitionGroup>`. Write unscoped
`<style>` against real elements; animation keys to native HTML state. Spacing
belongs to the parent context, not the leaf. Full argument and the single
`Pricing.vue` holdout: [references/cascade.md](references/cascade.md).

### Element-per-file architecture

Organize styles by HTML element, one file per element; the browser's element
model is the architecture. A foundation file holds what every element depends
on. Files needing breakpoint math or mixins stay in the preprocessor; the rest
are plain CSS. realness's instance: `src/style/` with `base-line.styl` as the
foundation. Details: [references/realness-instance.md](references/realness-instance.md).

## Mechanical checks

`.pi/bin/checks/soundness-check.js` verifies the rules that are true or false with no
judgement: a remote script, stylesheet, or import; a `#root/` import with no
import map; a `scoped` style or `<Transition>` in a Vue SFC. A Deno project
(`deno.json` or `deno.lock`) may import remotely - that is its pinned module
system, not an ad-hoc CDN. Run the checker on the files you touched:

```
node .pi/bin/checks/soundness-check.js <paths...>
```

`npm run check:soundness` covers the projects that follow this skill, realness
included. `npm run check:soundness:gate` is what `npm test` runs: the projects
this repo owns, so another repo cannot fail the realness suite. A line with
`soundness-allow: <reason>` excuses the matching hit. Everything else in this skill
is prose and stays yours to apply.

## Reference lint config

realness's `vite.config.js` (`lint` block) is the reference lint set for JS and
Vue projects; run `vp check`. It covers `no-var`, `prefer-const`, `eqeqeq`,
`arrow-body-style`, `no-param-reassign`, `max-params` 5, `no-magic-numbers`,
`object-shorthand`, and more. Copy it into a new JS or Vue project. It does not
cover every rule here: arrow functions over `function`, snake_case imports, and
comment/JSDoc discipline are `soundness` rules. A clean lint run is not the whole
standard.

## Before you call done

1. Build it through the project's real command.
2. Prove a fix: revert it and watch the new test fail, then restore.
3. Run the project's tests and checks.
4. Verify through the real entry point a user or caller uses. For generated
   sites, run the built-site gate above. For PWA behavior, complete the browser
   checks in `references/items-and-pwa.md`; report anything not verified.
5. For anything user-facing, check the rendered result in a browser: routes,
   assets, drafts, privacy, navigation, keyboard.
6. Confirm you changed only what the task needed.

Apply the `critic` skill: cheapest deterministic checks first, and do not grade
your own work.

## realness

realness is the reference look for every project, clients included. Its colors,
spacing, type, and feel are defaults: copy its values, do not re-derive them.
Read it locally at `apps/realness/src/app/style/` when it exists, otherwise at
<https://github.com/realness-online/web> (`src/style/`). Never block on a missing
checkout: this skill's values and
[references/realness-instance.md](references/realness-instance.md) are enough.

## Integration

- **user-interface**: clarity, affordance, and interaction decisions.
- **typography**: font pairing and voice; spacing and scale stay realness's.
- **motion-systems**: all animation decisions - defer entirely.

Every numbered value in this skill is the default for every project. Start each
project by linking realness's `palette.css` and `color.css` unchanged, synced
from source (`npm run palette`), plus root spacing properties. Other CSS uses
roles like `--accent`, never color literals; `npm run check:palette` enforces it.

## References

- [references/selectors.md](references/selectors.md) - selector decision order,
  `data-*` test, class carve-out.
- [references/wrappers.md](references/wrappers.md) - wrapper decision list and
  smell table.
- [references/spacing.md](references/spacing.md) - one unit, two axes.
- [references/cascade.md](references/cascade.md) - scoping, transitions, leaf
  spacing.
- [references/markup.md](references/markup.md) - element choice, headings,
  landmarks, forms, lists, links, images.
- [references/TYPE_SCALE_RECIPE.md](references/TYPE_SCALE_RECIPE.md) - ratio
  math, `clamp()` formula, bound-order gotcha.
- [references/COLOR_RECIPE.md](references/COLOR_RECIPE.md) - materials-and-roles
  method, adding a material.
- [references/realness-instance.md](references/realness-instance.md) - file
  tree, custom properties, type scale, palette.
- [references/BASELINE_STARTER.css](references/BASELINE_STARTER.css) - reset,
  spacing unit, horizontal values, fluid type scale.
- [references/examples/readable-renderer.md](references/examples/readable-renderer.md) -
  a real architecture/readability fix.
- [references/examples/vertical-rhythm-cleanup.md](references/examples/vertical-rhythm-cleanup.md) -
  a real spacing fix.
- [references/examples/gate-vs-limit.md](references/examples/gate-vs-limit.md) -
  a real breakpoint-gate fix.
