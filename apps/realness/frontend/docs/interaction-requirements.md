# Interaction requirements

Keep these behaviors together when changing input handling.

| Surface              | Required behavior                                                                                                                                                              | Automated coverage                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed                 | Community filter, profiles, dates, history loading, and thirteen-minute pairing remain stable.                                                                                 | `tests/views/Thoughts.spec.js`, `tests/use/feed.spec.js`, `tests/use/statements.spec.js`, `packages/thoughts/tests/`                           |
| Compose              | Tap or Tab to write; save on leaving; prevent duplicate saves; keep newlines and clipboard text.                                                                               | `tests/components/thoughts/as-textarea.spec.js`, `tests/plugins/key-commands.spec.js`                                                          |
| Own statements       | Tap on touch; double-click on desktop; Tab then Enter; preserve caret, draft, empty edits, sync updates, and rendered saved text.                                              | `tests/components/thoughts/as-thought.spec.js`, `tests/use/statements.spec.js`                                                                 |
| Other statements     | Read-only; desktop text remains selectable.                                                                                                                                    | `tests/components/thoughts/as-thought.spec.js`, built CSS check                                                                                |
| Poster captions      | Edit without toggling the poster; save without closing the caption; empty captions remain reachable through panel padding.                                                     | `tests/components/posters/as-figure.spec.js`                                                                                                   |
| Poster activation    | Touch hold activates once after 500 ms; mouse and keyboard activation remain available; moving or cancelling stops the hold.                                                   | `tests/use/poster-svg-activate-pointer.spec.js`, `tests/components/posters/as-figure.spec.js`                                                  |
| Scroll and crop      | Vertical feed scroll, horizontal storytelling scroll, portrait slice pan, and pinch zoom remain available.                                                                     | `tests/use/delegated-pan.spec.js`, `tests/components/posters/as-svg.spec.js`                                                                   |
| 3D and subjects      | Drag and orbit must not activate the menu; mask painting and erasing keep pointer ownership; subject controls remain usable.                                                   | `tests/components/posters/as-viewer-3d.spec.js`, `tests/use/mask-pen.spec.js`, `tests/components/posters/as-figure.spec.js`                    |
| App actions          | Footer, camera, Add, animation, preferences, and their native switches keep the trusted click path.                                                                            | `tests/App.spec.js`, `tests/use/touch-callout.spec.js`                                                                                         |
| Keyboard and dialogs | Shortcuts stay off while typing; Enter in a caption never toggles the poster; Shift-Enter and composition keep text entry active. Dialog controls and Escape remain available. | `tests/plugins/key-commands.spec.js`, `tests/components/thoughts/as-thought.spec.js`, `tests/components/profile/`                              |
| Files                | Image pick, camera, paste, drop, exports, and audio drop keep their existing entry points.                                                                                     | `tests/App.spec.js`, `tests/utils/clipboard-images.spec.js`, `tests/utils/export-poster.spec.js`, `tests/components/posters/as-figure.spec.js` |
| Connectivity         | Local statement saves survive reload; online/offline status, sync refresh, and safe app updates retain their existing rules.                                                   | `tests/sync-statements.spec.js`, `tests/use/reload-on-update.spec.js`, `tests/App.spec.js`                                                     |

## Touch selection and haptics

- Suppress browser callouts on app surfaces.
- Keep native selection and paste inside text editors.
- Keep desktop statement selection outside editing.
- Do not cancel pointerdown, pointerup, touchmove, or clicks to suppress a menu.
- Keep existing native switches. A synthetic click does not prove physical feedback.
- Android long-press feedback uses the Vibration API.
- The poster-wide direct-switch experiment broke scrolling and was discarded.
- Do not promise an iPhone long-press buzz from the retained label overlay.

Sources: June 29, 2026 session `019f1460` (default suppression with statement opt-in), August 9 session `019fe800` (saved edits must render), and October 3 session `01a102ae` (canvas callouts, dragging, switches, and scroll regressions).

## Release gate

From `apps/realness`:

```
npm run test:frontend
npm run check:frontend
npm run type
node tools/cli/bin/realness.js frontend build --env production
```

The build runs `check-interaction-css.js` against the shipped CSS. It fails if Safari selection prefixes or callout rules disappear. `npm run check:interaction-css` repeats that check on an existing build.

Use the built app for browser checks. Unit tests mount editors into the page and use real focus/blur. They must fail when the fix is removed.

### Known storage gap

The statement updater searches the current stored section. It does not update an archived page when the statement is absent from that section. This interaction patch does not fix that storage path. Do not claim archived edits are verified.

### Device checks

Before release, check on an iPhone and Android phone:

1. Compose, edit, save, reload, then edit again. Try an empty statement, a caption, and an older statement loaded from history.
2. Select and paste inside the editor. Try a new line and composed text.
3. Scroll from a statement, poster, caption, and native switch. Check storytelling too.
4. Long-press a poster in SVG and 3D. Confirm one activation and no browser callout. Move before the hold threshold and confirm no activation.
5. Drag the 3D view, pan a sliced poster, pinch, and paint/erase a subject. Confirm menus do not open during movement.
6. Use Add, camera, animation, 3D, footer, and preference switches. Check physical feedback separately from checked state.
7. Open download and other caption actions with touch and keyboard. Confirm the poster stays in place.

Headless browser emulation cannot verify Safari's native selection menu, the iPhone keyboard, gyro permissions, camera hardware, or physical vibration.
