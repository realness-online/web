---
hidden: true
name: page
description: Make a page a person can open - a note in the vault, given the layout that fits it, published at its own link. Use when asked to "build an executive dashboard", "make a page for this project", "turn this into a one-pager", "publish this so I can share it", "start an article", "make a deck", or "give me a link to send someone". Holds the layouts, the palette rule, the checks, and the publish step.
metadata:
  check: 'node ../../bin/checks/check-skills.js page'
---

# Page

A page is a note in the vault that a person opens at its own link.

## Pick the layout

Guess from the request, then say the layout and why in one line.

| Layout    | Fits                                                    |
| --------- | ------------------------------------------------------- |
| `app`     | notes and plans; the default                            |
| `article` | prose read top to bottom                                |
| `canvas`  | the page sets its own frame: dashboard, animation, demo |
| `deck`    | slides for a talk                                       |
| `print`   | a CV, a handout                                         |

The note's `layout:` line wins. No line means `app`.

An HTML page keeps its own head, styles, and scripts, so it needs no layout.

## Rules

- A layout sets the frame. Colors, type, and spacing come from the palette at `apps/realness/src/app/style/palette.css`.
- Structure first: semantic HTML with Schema.org microdata, one `<article>` per item.
- The product renders the page. Nothing is copied.

## Write the note

1. Write `vault/Resources/<name>.md` with `title`, `created`, and `layout:`.
2. Give it an itemid:
   `node apps/realness/tools/publish/bin/publish.js items mint Resources/<name>.md --type pages`
3. The link is `https://haight.realness.online/vault<itemid>`. The app serves it live.

## Checks

1. `npm run check:layouts` in `apps/realness`: every frame, in a browser.
2. Open the link at 390 and 1920 pixels wide; `scrollWidth` stays within the window.
3. `soundness`: semantic HTML, microdata, palette only.
4. `user-experience`: a person reads it without help.

## Give the link

Give back the link. An edit shows at the same link, live.
Publishing to GitHub waits; the plan decides it.
