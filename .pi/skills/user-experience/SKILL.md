---
hidden: true
name: user-experience
description: Designs or reviews user interfaces that are self-evident, low-friction, and easy to understand with minimal explanation. Use when asked to "make this screen clearer", "cut the helper text", or "why does this form confuse people".
metadata:
  check: 'node ../../bin/checks/check-skills.js user-experience'
  category: Design & UX
  pairs-with:
    - skill: soundness
      reason: Native elements carry affordance before CSS; boolean attributes are state CSS reads directly
    - skill: page-motion
      reason: This skill decides what changes; page-motion decides how it moves
  tags:
    - ux
    - ui
    - interaction-design
    - forms
    - usability
---

# UX Interface Design

If the UI needs instructions, fix the UI - not the copy. Structure,
hierarchy, constraints, and interaction carry meaning; text confirms it.

Not for: marketing copy, pure visual styling critiques, long-form docs, or
interfaces where detailed explanation is the product.

## Rules

1. **Structure over text.** Layout, grouping, and affordances make meaning;
   labels and helper copy are a last resort. Before adding text: better
   layout, more specific controls, better defaults. Never repeat what
   context shows ("Submit Form" -> "Submit"); never narrate ("Click below
   to continue").
2. **Defaults and constraints over instructions.** Preselect the common
   option; start in the most useful state. Prevent invalid input with
   constraints and live validation instead of explaining rules up front.
3. **Feedback lives at the point of interaction.** No top-of-page error
   summaries, no disconnected instructions. Explain only when an error
   occurs or the system genuinely needs input.
4. **Show, don't tell.** Real previews, inline examples, visible state
   changes - not instructional paragraphs. If explanation is unavoidable,
   one short sentence; needing more means redesign.
5. **Hierarchy over whitespace.** Strong grouping, one obvious primary
   action, visible priority. Dense is fine if it stays scannable. Don't
   name every section - that's the AI verbosity bias.
6. **A shape can say "on purpose".** When a layout limit leaves empty
   space, fill it with an existing surface (the status box, a panel) so it
   reads as designed. Never add words to explain the gap. Prefer CSS that
   follows the limit - flex growth, `:has()`, container size - over script
   that measures it.
7. **Name the result.** A control says what happens ("Send invoice",
   "Delete 3 drafts"), not what it is ("Submit", "OK"). Rename it when the
   effect changes.
8. **Undo before confirmation.** A reversible action needs no dialog: do
   it, then offer undo. Save confirmation for what cannot be undone, and
   name what it costs.
9. **An empty page names its action.** Before the first item exists, show
   the way to make one. Never explain the product in the space the first
   item will fill.
10. **Work in flight looks like work.** Pending actions show where the
    result will appear, and the result replaces that, not a banner far
    away. A dead control says what unlocks it, in place; hiding the reason
    reads as a bug.
11. **Long content is the normal case.** A long name, a long list and a
    crowded day each get a stated treatment: wrap, truncate with the full
    value reachable, or scroll a region. Do not let the layout guess.
12. **One name per thing.** The same object keeps one name across screens,
    buttons and headings. A second word for it is a second concept to the
    person reading.
13. **Say where they are.** A page carries enough location to answer what
    this is and what it belongs to, and a way back that does not rely on
    the browser.
14. **Validate after leaving a field.** Show an error once the field loses
    focus or the form is sent, and clear it as soon as the input is valid.
    Never mark a field invalid while it is being typed for the first time.

## Template tells

These defaults make a page read as generated. Use one only when the content
asks for it.

- All-caps eyebrow labels above headings.
- Meta strings joined with middle dots (`A · B · C`).
- `→` appended to link and button text.
- Numbered markers (01 / 02 / 03) on content that is not a sequence.
- One accent word in a headline, set in italic, bold, or another color.
- Content chopped into identical rounded cards with the same shadow.
- A fade-and-slide-up entrance on every section.

## Accessibility

1. **Measure text against what sits behind it.** 4.5:1 for body text, 3:1
   for large text and for a border or icon that carries meaning. Measure
   the rendered pair, tinted surfaces and states included.
2. **Every target reaches 24 by 24 CSS pixels.** Where the element cannot
   grow, give its neighbours room instead.
3. **Focus follows reading order.** Visible focus, keyboard reach for every
   action, focus entering a dialog and returning on close, and closed
   navigation out of the tab path.
4. **Nothing hides behind a limit.** A sticky header must not cover the
   focused control; content reflows at 320 pixels wide and survives text
   at 200%.

## Review

1. Remove the descriptive text - does the interface still work?
2. Is there exactly one obvious next action?
3. Fix layout, grouping, defaults, constraints before adding copy.
4. Are errors prevented rather than explained?
5. Delete anything that does not directly enable action - helper text under
   every input, onboarding tooltips for simple flows, pages that explain
   before allowing interaction.
6. Does any template tell appear without a reason in the content?
7. Do control names predict the result, and can the risky one be undone?
8. Is the empty state an action rather than an explanation?
9. Does it work by keyboard, at 320 pixels wide, and at 200% text?
10. Is pending visible where the result will land, and does a dead control
    say what unlocks it?
11. Does a long name, a crowded day and a long list each have a stated
    treatment?
12. Does one thing keep one name, and does the page say where it sits?

## Integration

- **soundness**: the right element is its own affordance - `<details>`
  discloses, `<dialog>` is modal; boolean attributes (`open`, `disabled`)
  are state CSS reads without JS.
- **page-motion**: what changes is decided here; how it moves is decided
  there.
- **typography**: font pairing, scale, and web font loading. Read
  [typography/typography.md](typography/typography.md) when type is the
  question; realness's scale stays the default.
