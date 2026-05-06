# Profile account hero (plan and status)

## Goal

Improve own-profile account UX when toggling the avatar poster: dim the rest of the UI, slide the account panel from the top, behave well on desktop width, and give a clear entry when no avatar is set. Keep the existing sign-on architecture elsewhere for now (`as-dialog-account`, profile inline sign-on).

## Done

| Item                 | Implementation                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top sheet + backdrop | `as-aside-account.vue`: `<aside role="dialog">` in a teleport, full-viewport backdrop (`black-transparent`). Escape and backdrop click close.                                    |
| Desktop              | Panel centered, `max-width: page-width`, widens to `page-width-large` on large viewports; scrollable if content is tall.                                                         |
| No avatar            | `as-figure.vue` (profile): placeholder block (`profile-hero-no-avatar`) with silhouette + "Account" opens the same sheet.                                                        |
| Account menu         | `Account.vue` renders the name form + sign off inline (was `as-menu-account.vue`, now folded into the page).                                                                     |
| Poster integration   | `posters/as-figure.vue`: prop `account_sheet`. When true and the account menu is open, footer content (time + default slot) renders inside the sheet instead of over the poster. |

## Wiring (reference)

- Profile hero with avatar: `as-figure.vue` passes `:account-sheet="is_me && !!current_user"` to `poster-as-figure`. Account menu now lives inline in `Account.vue`.
- Others on your profile: unchanged messenger slot; `menu_always_visible` still drives visitor hero footer.

## Deferred (separate effort)

- One sign-on surface: dialog vs profile `#account` vs Thoughts header (`docs` discussion; no change in this track).
- `open_account` / `register_account` in `App.vue` still unused by most routes; optional cleanup when feed migration lands (`user-experience-refactor.md`).

## Verification

```bash
npm test -- --run tests/components/profile/as-figure.spec.js tests/components/posters/as-figure.spec.js
```

Manual: own profile signed in, tap hero poster, sheet + dimming; Escape; backdrop tap; own profile without avatar, tap Account placeholder.

## Follow-ups (optional)

- Focus first focusable in sheet on open; restore focus on close.
- `inert` on `main` while sheet open (a11y).
- Component test for `as-aside-account` (Escape, backdrop).
