# Cascade over scoping

Deep dive for the "Cascade over scoping" rule in SKILL.md.

## Method

Don't use Vue's `scoped` style attribute or Vue's `<Transition>`/`<TransitionGroup>`
components. Both work against a system built on the global cascade and
semantic-element selectors.

## Why `scoped` fails here

`scoped` rewrites element selectors into attribute-hashed ones behind the
scenes. It defeats "the element IS the selector" and blocks the cross-component
cascade rules the architecture depends on: a parent's `article > header` reaching
into a child's markup, a page-level class gating a descendant's layout. Write
plain, unscoped `<style>` blocks that select real elements and attributes. File
load order plus normal specificity do the scoping work, the same way the
element-per-file architecture relies on cascade order rather than isolation.

## Why `<Transition>` is an exception, not a default

`<Transition>`/`<TransitionGroup>` swap in Vue-managed enter/leave classes in
place of CSS you would otherwise write directly against an element's own
attributes. Author animation as plain `animation`/`transition` properties keyed
to native HTML state (`[open]`, `:active`, a boolean prop reflected as an
attribute - see "HTML attributes as application state" in SKILL.md), colocated
in the element's own style block.

realness's instance has exactly one holdout: `Pricing.vue` uses
`<transition name="slide" mode="out-in">`, with its own style block commented
`// Vue transition hooks (framework mechanic, not a styling selector)`. That
comment is the tell - the author flagged it as the exception. Treat any new
`<Transition>` usage the way `motion-systems` treats animation decisions: a
deliberate, justified departure.

## Spacing lives in the cascade, not the leaf

A component's own outer `margin`/`padding` is often not its job. The parent
context (a `section`'s padding, a flex `gap`, `standard-grid`) already
establishes the rhythm around it. A leaf component that also asserts its own
outer spacing doubles up against that rhythm or fights it when reused in a
different parent.

Before adding `margin`/`padding` to a component's outermost element, check
whether it can be assumed from further up the tree. This extends "one unit,
whole multiples": cascade-inherited spacing is the default. A component
asserting its own outer spacing is the exception, reserved for rhythm genuinely
internal to that component (padding between its own children), not the space
around it.
