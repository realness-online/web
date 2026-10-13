# Selectors: real, not invented

Deep dive for "Semantic selectors, not invented ones" in SKILL.md.

## Method

Write every CSS selector against something real - an element, native state,
microdata, or ARIA. Never invent a name (a class, or a `data-*` that exists only
to be a selector) for something that already has an honest attribute.

- **Real** = something a human, crawler, or the data layer (`get_item`, Schema)
  should already recognize.
- **Anonymous** = a node with no meaning outside one widget's internals (spinner
  spoke, measurement ghost).

## Decision order

Walk this list and stop at the first honest fit:

1. Wrong element? Fix the tag.
2. Native state exists? Use it - `[open]`, `:checked`, `:invalid`, `[hidden]`,
   `[disabled]`, `:has(dialog[open])`.
3. Meaning for data already needs microdata? Style that - `[itemprop]`,
   `[itemscope]`, `[itemid]`, `[itemtype]`.
4. Meaning for a11y already needs ARIA? Style that - `[aria-*]`, `[role]`.
5. Global mode, not an element? One attribute on a high node
   (`html[data-aspect-ratio='16/9']`) - not a class or a `data-*` tree on every
   region.
6. Still anonymous chrome? A class is allowed - see below.

Microdata and ARIA aren't accessibility/SEO add-ons bolted on afterward.
They're load-bearing CSS selectors here, so adding them is never wasted work.

If you reach for a class or a new `data-*` for a **region or product thing**
(page shell, poster, days feed, delete button), you're reaching for the wrong
element or missing an existing attribute. Prefer `id` + landmark, parent/child
structure, `figure:has(svg[itemtype='/posters'])`, `[itemid]`, or an accessible
name instead.

## `data-*` earns its keep or it doesn't

| Earns its keep                                                           | Does not                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Real app/document state CSS must read (`html[data-aspect-ratio='16/9']`) | Renaming a section so you can style it (`data-page` ~ `.page`)                  |
| Bridging JS <-> CSS for boolean state with no native home                | Product nouns invented for CSS (`data-poster`, `data-days`)                     |
|                                                                          | Widget catalogs that should be element + accessible name (`data-icon='camera'`) |

A `data-*` attribute that is really a selector is a class with different
punctuation.

## Class carve-out

A class is allowed only when all of these hold:

1. The node isn't a meaningful element (spinner chrome, measurement ghost,
   layout scrap with no schema).
2. No native, ARIA, or microdata attribute honestly fits.
3. The name is local to one component's `<style>` block, not shared app
   vocabulary.
4. You'd be ashamed to put that same string on `data-*` for the whole app.

If allowed: BEM-flavored (`block__part`, `is-state`), scoped to that one
component - never a bare reusable name like `.card`.

## The result

Element, selector, and microdata attribute converge on the same thing:

```css
address[itemscope] {
  font-style: normal;
}
time {
  font-weight: 300;
  display: block;
}
```

Correct semantics reduce the selectors you need. Microdata gives you structural
hooks without extra classes. Element-based CSS rewards using the right element.
When you style `time` properly, you use `<time>` properly.

## realness's carve-outs

Two live exceptions, not patterns to extend: `preference.vue`'s `.compact` and
`working-border.vue`'s `.working-border`. Before adding a third, run the
decision order above first. Known drift to remove when touching files:
[realness-instance.md](realness-instance.md).
