# Realness – Color System

`/colors` in the running app is the living reference — every material, role, and
combination rendered with its actual values. This doc is the "why" that doesn't
fit on that page: the naming conventions, the guardrails, and the known gaps,
for whoever touches this next.

## Two layers: materials and roles

`src/style/palette.css` defines **materials** — named for character, not
wavelength or function (`water`, `clay`, `slate`, `ochre`, and the
geology set `sediment` → `boulders`). A material is just paint. It doesn't know
what it's for.

Each variant has three **weights**: `fill` (solids), `darken` (foreground on
light surfaces), and `lighten` (foreground on dark surfaces). The suffix names
the lightness direction the paint is tuned for, not the surface itself. Signals
(`ochre`) and the geology set also carry `darken`/`lighten` pairs alongside
their bare/base value, so every named color in the system can be tuned for
legibility on both light and dark ground.

`src/style/color.css` defines **roles** — the jobs components actually touch
(`--accent`, `--emphasis`, `--working`, `--warning`, `--text`, `--surface`,
`--muted-text`, and related derived values). Each role points at a material and
flips for `prefers-color-scheme: dark`. Components reference roles, never
materials, so a rebrand is a few lines in `color.css`, not a hundred call sites.

Surfaces (`chalk`, `bone`, `graphite`, `pumice`, `basalt`, `moonlight`) live in
`palette.css` as raw swatches and are wired to roles in `color.css` (`--text`,
`--surface`, `--code-surface`).

`src/style/base-line.styl` holds layout values (`--base-line`, breakpoints) and
Stylus-side aliases (`accent = unquote('var(--accent)')`) for `.styl` files.

## Material bypasses

`tests/style/role-material-boundary.spec.js` enforces that components reach for
roles, not materials. A few deliberate exceptions exist (poster mosaic layers,
dev overlays) and live on an explicit allowlist. If you're about to reach for
`var(--water-fill)` in a new component, that test will fail and tell you to
either go through a role instead or add yourself to the allowlist on purpose.

## Naming

Materials are named for what they evoke, not for hue or role, so the name
survives a rebrand. The geology set doubles as the actual poster mosaic layer
names (`sediment`/`sand`/`gravel`/`rocks`/`boulders` — same five names in
posters, prefs, and export). `ochre` is a signal color: it interrupts rather
than decorates, and is deliberately the same value in both color schemes rather
than having light/dark variants.

## Picking values: OKLCH, not HSL-by-eye

HSL numbers lie about how a color will actually look — two colors with matching
lightness/saturation can be wildly different in perceived brightness (yellow vs.
blue), and hue alone doesn't guarantee two colors read as distinct. Every
harmony fix this system has gone through (desaturated accent, gravel/rocks
collapsing into the same gray) was diagnosed by converting to OKLCH
(`src/utils/color-converters.js` → `hsl_to_oklch`) and comparing L (lightness),
C (chroma), and H (hue) directly, not by eyeballing the HSL source.

`tests/style/color-harmony.spec.js` encodes the specific lessons learned:

- text/surface pairs clear WCAG AA (4.5:1)
- `--accent`/`--emphasis`/`--working` stay ≥40° apart in hue, in both schemes
- the geology ramp gets monotonically darker, and any adjacent pair with a tight
  lightness step also has enough hue separation to read as distinct materials
  instead of the same gray

It parses `palette.css` directly (`tests/helpers/palette.js`) rather than
duplicating values, so it can't drift from the real source.

## Interaction states

`focus-ring()` (`src/style/mixins/standards.styl`) is the one focus treatment to
reach for — `--accent` outline derived from `base-line * 0.10`
that tracks whichever role rebrand is live. Before this existed, several controls
(the Settings button, the bottom-nav labels, the feed-filter toggle) silently
dropped their focus outline with no replacement, which is a real accessibility
bug, not just a style choice. If a component hides its real input (the two
toggle switches do this — an invisible `<input>` with a visible sibling
`<span>`), style `input:focus-visible + span` instead; the mixin only helps when
the focused element is the visible one.

Hover states don't have a shared mixin — the two conventions already in
informal use are `background: var(--emphasis); color: white;` for menu-style
items, and `color-mix(in srgb, var(--accent) 12%, transparent)` for subtle CTA
highlights. Neither is enforced. The CTA one used to be
`alpha(water-fill, 0.12)` — a material, not a role — and it silently went stale
the moment light-mode `--accent` pointed at a different material. `color-mix()`
against `var(--accent)` fixes that class of drift for good: it reads the role at
paint time instead of freezing whatever material backed it when the CSS was
written.

## Known gaps

- `--working` (backed by `slate`) is only
  used in a few places so far.
- No `prefers-contrast` or `forced-colors` handling.
- `role-material-boundary.spec.js` catches both `var(--material)` and bare
  Stylus color-function calls (`alpha(water-fill, 0.12)`), but a material name
  could still slip past it inside something the regex doesn't anticipate — e.g.
  a Stylus variable interpolated into a string, or a new color function. It's a
  guardrail, not a guarantee.
