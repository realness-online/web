# Spacing: one unit, two axes

Deep dive for the "Spacing: one unit, two axes" rule in SKILL.md.

## Method

Pick one spacing unit. Derive every margin, gap, and padding from it as a
multiple. Not arbitrary pixels, not `rem` guesses. When something feels off,
check whether it's a multiple.

The unit governs two axes differently, because they mean different things
physically.

## Vertical harmony is non-negotiable

Vertical measurements are whole multiples. Margin-top, margin-bottom,
padding-top, padding-bottom, line-height - anything that decides where the next
line lands - must be `unit x 1`, `x 2`, `x 4`, never `x 0.35` or `x 0.5`.

A fractional vertical multiple isn't a smaller version of the same rhythm. It's
off the grid entirely, and it shifts every block beneath it out of phase with the
page's baseline. That drift compounds down the page and breaks alignment between
columns that don't share the same fractional offset. Worked example:
[examples/vertical-rhythm-cleanup.md](examples/vertical-rhythm-cleanup.md).

## Horizontal harmony is looser on small values

Gap in a row and padding-left/right aren't part of the baseline grid - they don't
move where a line of text sits vertically - so they can use whatever fraction of
the unit looks right (`x 0.35`, `x 0.5`).

The big horizontal decisions recur across a codebase: a prose measure, a
breakpoint gate, a content-width ceiling. An untracked project ends up with three
components each inventing their own "wide container" number. Keep those as a
small closed set of named custom properties derived from the unit (a measure, a
gate, a limit), and reach for an existing one before minting a new magic number.
If nothing fits, name the new one - don't inline a fresh multiple and let it
drift. A gate and a limit look interchangeable and aren't:
[examples/gate-vs-limit.md](examples/gate-vs-limit.md).

## Use realness's layout spacing everywhere

Vertical: `var(--base-line)` (1.333rem) times a whole number - page sections end
`x 4`, headers pad `x 1`. Horizontal: small gaps and inline padding are
`var(--base-line)` or a fraction of it.

Widths come only from realness's named set: `--page-width` (measure),
`--page-width-large` (gate), `--page-width-max` and `--support-page-width`
(limits). Copy those custom properties into the project's root.

## The check

When something feels off, check three things:

1. Is it a multiple of the unit?
2. If it's vertical, is it a whole one?
3. If it's a big horizontal number, does a name for it already exist?

A copy-paste starter implementing the reset, the unit, and these categories:
[BASELINE_STARTER.css](BASELINE_STARTER.css). realness's own current values:
[realness-instance.md](realness-instance.md).
