# Realness – Color System

`/colors` in the running app is the living reference — every material, role,
and combination rendered with its actual values. This doc is the "why" that
doesn't fit on that page: the naming conventions, the guardrails, and the
known gaps, for whoever touches this next.

## Two layers: materials and roles

`src/style/variables.styl` defines **materials** — named for character, not
wavelength or function (`water`, `clay`, `moss`, `slate`, `heather`,
`sulfur`, `ochre`, and the geology set `sediment` → `boulders`). A material
is just paint. It doesn't know what it's for.

`src/style/color.styl` defines **roles** — the jobs components actually
touch (`--accent`, `--emphasis`, `--info`, `--danger`, `--warning`,
`--caution`, `--success`). Each role points at a material via
`light-accent-tokens()` / `dark-accent-tokens()`. Components reference
roles, never materials, so a rebrand is one line in `color.styl`, not a
hundred call sites.

Surfaces (`chalk`, `bone`, `graphite`, `pumice`, `basalt`, `moonlight`) are
a separate concern from materials/roles — they're the ground things sit on,
wired through `light-surface-tokens()` / `dark-surface-tokens()`
(`--text`, `--surface`, `--code-surface`).

## The blessed exception

`.water` and `.graphite` in `color.styl` are the one sanctioned place a
component paints with a material directly instead of a role — used where a
control should read as a material (the install CTA, the compose box), not
a semantic state. `tests/style/role-material-boundary.spec.js` enforces
that this stays a short, explicit, reviewed list instead of spreading
unnoticed. If you're about to reach for `var(--water-fill)` in a new
component, that test will fail and tell you to either go through a role
instead or add yourself to the allowlist on purpose.

## Naming

Materials are named for what they evoke, not for hue or role, so the name
survives a rebrand. The geology set doubles as the actual poster mosaic
layer names (`sediment`/`sand`/`gravel`/`rocks`/`boulders` — same five
names in posters, prefs, and export). `sulfur`/`ochre` are signals: they
interrupt rather than decorate, and are deliberately the same value in
both color schemes rather than having light/dark variants.

## Picking values: OKLCH, not HSL-by-eye

HSL numbers lie about how a color will actually look — two colors with
matching lightness/saturation can be wildly different in perceived
brightness (yellow vs. blue), and hue alone doesn't guarantee two colors
read as distinct. Every harmony fix this system has gone through
(desaturated accent, sulfur/ochre reading as twins, gravel/rocks
collapsing into the same gray) was diagnosed by converting to OKLCH
(`src/utils/color-converters.js` → `hsl_to_oklch`) and comparing L
(lightness), C (chroma), and H (hue) directly, not by eyeballing the HSL
source.

`tests/style/color-harmony.spec.js` encodes the specific lessons learned:

- text/surface pairs clear WCAG AA (4.5:1)
- `--accent`/`--emphasis`/`--info` stay ≥40° apart in hue, in both schemes
- signal colors (`sulfur`/`ochre`) keep a real OKLCH lightness gap, not
  just a hue difference
- the geology ramp gets monotonically darker, and any adjacent pair with a
  tight lightness step also has enough hue separation to read as distinct
  materials instead of the same gray

It parses `variables.styl` directly (`tests/helpers/palette.js`) rather
than duplicating values, so it can't drift from the real source.

## Interaction states

`focus-ring()` (`src/style/mixins/standards.styl`) is the one focus
treatment to reach for — a 2px `--accent` outline that tracks whichever
role rebrand is live. Before this existed, several controls (the Settings
button, the bottom-nav labels, the feed-filter toggle) silently dropped
their focus outline with no replacement, which is a real accessibility
bug, not just a style choice. If a component hides its real input
(the two toggle switches do this — an invisible `<input>` with a visible
sibling `<span>`), style `input:focus-visible + span` instead; the mixin
only helps when the focused element is the visible one.

Hover states don't have a shared mixin yet — the two conventions already
in informal use are `background: var(--emphasis); color: white;` for
menu-style items, and `background-color: alpha(water-fill, 0.12)` for
subtle CTA highlights. Neither is enforced.

## Known gaps

- `moss`, `slate`, and `heather` are fully harmonized but still mostly
  unused — `slate` now backs `--accent` in light mode, `heather` backs
  `--info`, but `moss` (`--success`) has no real consumer yet.
- No `prefers-contrast` or `forced-colors` handling.
- The role/material boundary test only catches `var(--material)` CSS
  references — it doesn't catch bare Stylus function calls like
  `alpha(water-fill, 0.12)`, which is how the CTA hover highlight above
  gets away with referencing a material without tripping the test.
