# No invented wrappers

Deep dive for "No invented wrappers" in SKILL.md.

## Method

A node that exists only so CSS (or JS) can target "this group" is usually the
wrong shape. Prefer no wrapper, a real element, or the attribute you already
need for meaning - not `<div data-thing>` / `<div class="thing">`.

When you reach for a wrapper, ask what job it does and stop at the first honest
fit:

1. **Only one meaningful child?** Delete the wrapper. Style/select the child
   (`textarea#wat`, `figure:has([itemtype='/posters'])`).
2. **Two siblings that must stay adjacent for CSS** (`nav + section`)? Vue
   multi-root - no shell. realness: `support-layout.vue` is just `<site-nav />`
   - `<router-view />`.
3. **Grouping form controls?** Use `<fieldset>` (or `<form>` when submit is the
   action). Style `fieldset:has(> #wat)`, not `data-posting-input`.
4. **ARIA / landmark role belonging to the region?** Put the role on the region
   you already have - `section[data-days][role='feed']` - not a child
   `<div role="feed">` whose only job is the role.
5. **Parent needs to reflect child meaning?** Prefer `:has()` on something real
   (`figure:has([itemtype='/posters'])`) over inventing `data-poster` on the
   parent. Keep JS `closest` / `querySelector` on the same hooks; leaving
   `closest('figure.poster')` after deleting `.poster` is a silent break.
6. **Still need a host with no honest element?** Only then: local class for
   anonymous chrome (see [selectors.md](selectors.md)) - never a shared `data-*`
   product noun.

## Smells

| Smell                                               | Prefer                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `<div data-support-layout>` around nav + view       | Multi-root fragment                                                                                          |
| `<div data-posting-input>` around textarea + button | `<fieldset>` / `<form>`                                                                                      |
| `<div role="feed">` around day articles             | `role="feed"` on the existing section                                                                        |
| `figure[data-poster]` / `.poster`                   | `figure:has([itemtype='/posters'])` (processing figure may carry `itemtype` on itself when no child SVG yet) |
| `data-*` renamed from a former class                | Re-run the selector decision order - punctuation is not progress                                             |

If a wrapper stays, its **element** must earn the keep (fieldset, form, dialog,
nav). An attribute hung on a meaningless `div` so the stylesheet can see it does
not.
