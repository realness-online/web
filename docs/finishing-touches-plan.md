# Realness — Finishing Touches Plan

_Created 2026-06-25 · **Status: PARKED 2026-06-26** — deferred pending real usage. No one is using
Realness yet; this is launch-hardening for unvalidated demand. The thinking is captured (incl.
`realness/docs/security.md`); the building waits until there are users and signal that it matters._

Documentation and the product/About page are done. This is the remaining punch list to get
[realness.online](https://realness.online) over the finish line — spanning features, bugs, infra,
design, and non-engineering review. _(Done & pruned: #1 push notifications, #4 Stripe.)_

Source repos:

- App: `/Users/scott/Desktop/brain/work/realness` (currently `2.5.4`)
- Functions / send paths: `/Users/scott/Desktop/brain/work/realness-functions`

**Legend** — Effort: `S` < ½ day · `M` ½–2 days · `L` 2+ days. Kind: feature · bug · infra · design · non-eng.

---

## Priority call

The recommended order groups work into focused passes so we're not context-switching between the
canvas, the auth screens, and marketing in the same sitting. Infra (#3 email) and non-eng (#13
legal) run in parallel since they don't block code.

---

## Phase 1 — Money & legal (parallel, off the critical path)

### 13. Legal — `non-eng` · `M` _(UN-PARKED 2026-06-28 — user-facing legal layer BUILT; now in attorney-review state)_

**This item is the home for all Realness legal work.** Realness collects phone numbers (PII)
and hosts user-generated content, so it needs a license, a Terms of Service, and a Privacy
Policy before it goes live or charges money.

**Status (2026-06-28): built into the app, pending attorney review.** Goal was to push it as
far as possible so legal work is mostly review. Shipped:

- **Terms of Service** — `src/content/terms.md` → `/terms` (Terms.vue + legal-page.vue).
- **Privacy Policy** — `src/content/privacy.md` → `/privacy` (Privacy.vue + legal-page.vue).
- **Clickwrap consent** at sign-up — "By continuing you agree to the Terms and Privacy Policy"
  above the authorize button in `as-form-mobile.vue`, linking both pages.
- Generic markdown renderer extracted: `documentation-content.js` → **`src/utils/markdown.js`**
  (`markdown_html` / `markdown_toc`), reused by docs + legal pages.
- **Attorney-review package** authored: `realness/docs/legal/attorney-review.md` — first-pass
  findings (risk flags H-1…H-4, missing terms, Terms↔Privacy↔LICENSE consistency check, next
  steps) to hand to counsel. lint/type/tests green.

**Decisions (firm, 2026-06-28)**

- **License model — source-available.** Anyone may read, run, modify, and self-host Realness.
  Self-hosters/orgs **assume their own legal responsibility** for the instance they run.
  Running an instance for a **team ($100/yr) or organization ($500/yr) requires a paid
  commercial license**; individual use + commercial use of your own poster outputs are free.
  Source-available ≠ open-contribution: publishing the source creates **no obligation to
  accept pull requests**. See [[project_realness_licensing]].
- **Business structure — sole proprietorship; NOT incorporating.** Scott runs realness.online
  personally (no LLC/Inc). Governing law: **California** (Scott's residence).
- **Liability reality (drives the strategy).** A sole prop has no liability shield — but per
  Scott's CEO experience, plaintiffs name the individual regardless of entity, and as the solo
  operator + moderator he personally performs nearly every platform act (so an LLC wouldn't
  shield "participation" liability anyway). Protection is a **stack**, not an entity:
  1. **§230 intermediary immunity** for user-posted content (the biggest lever).
  2. **DMCA safe harbor** — register a designated agent.
  3. **Enforceable TOS** — assent at sign-up (clickwrap) + arbitration + class-action waiver
     - liability cap.
  4. **Data minimization** — already strong (source images discarded on-device; minimal data).
  5. **Insurance** — tech E&O / cyber-liability as the financial backstop that pays defense
     whether named personally or not. **This, not the entity, is the practical protection.**
- **Moderator chain-of-responsibility** offloads liability for _self-hosted_ instances; for
  the default hosted instance Scott is operator + moderator, so the stack above carries it.

**Production artifacts to ship (when the plan un-parks)**

- **Terms of Service** + **Privacy Policy** authored production-ready and rendered as app pages
  from `src/content/` (same pipeline as `documentation.md`), at routes `/terms` and `/privacy`,
  linked from the **sign-up consent line** and site nav/footer.
- **LICENSE** (source-available) at repo root; `package.json` `license` set accordingly.
- Pricing page **renamed `License.vue` → `Pricing.vue`** (done 2026-06-28; `/license` still
  redirects to `/pricing`).

**Remaining tasks** _(production copy now drafted in-app; these are the human/legal gates)_

- ~~Write the production TOS + Privacy copy~~ — **done**; drafted with CA governing law, age-13
  minimum, sub-processors (Firebase + reCAPTCHA), phone-derived identity / deletion-export note,
  data-minimization, arbitration + class-action waiver (30-day opt-out) + liability cap.
- ~~Define written per-tier entitlements~~ — **done** in Terms §7 (annual auto-renew, 14-day
  refund, taxes on customer). CA ARL purchase-UI obligations attach when self-serve checkout exists.
- **Attorney review** of the draft (esp. arbitration/waiver, clickwrap form, liability cap).
- Register a **DMCA agent** with the U.S. Copyright Office (referenced in Terms, not yet filed).
- Confirm **§230** posture; line up **E&O / cyber insurance** (the real backstop); file a **DBA**
  for "Realness" if required in CA.
- Decide **checkbox vs. sign-in-wrap** assent (trivial to add in `as-form-mobile.vue`).
- Re-run the review when **Twilio** (#20/#21) is added and when **checkout** ships.
- See `realness/docs/legal/attorney-review.md` for the full flagged-findings list.

**Where:** this doc (home) · eventual `src/content/terms.md` + `privacy.md` · `LICENSE` ·
`src/views/Pricing.vue` · `docs/philosophy.md` · `docs/monopoly.md`.

---

## Phase 2 — Account & auth pass (one focused sitting)

### 5. Refactor sign-in page to be more standard — `refactor/ux` · `M`

- **Acceptance:** sign-in follows conventional patterns (clear fields, states, errors);
  no surprising custom flow.
- **Where:** `src/views/Account.vue`, `src/components/account/`.
- **Note (2026-06-28):** the inline sign-in fold (`/sign-on` merged into `/account`, `as-sign-on`
  owning the phone→name gate) and the signout confirm dialog (#15) already shipped in app
  `07d25296`; what remains under #5 is the broader "conventional patterns" polish.

### 6. Require a name — `validation` · `S`

Everyone must enter something for their name.

- **Acceptance:** account/profile can't be saved with an empty name; existing nameless
  users are prompted on next visit; validation message is clear.
- **Where:** account/profile components under `src/components/account/`.
- **Note:** already on the old vault `TODOs.md` ("make sure everyone has a name").

### 15. Sign in / sign out are out of the way — `ux` · `S`

Make auth state and actions discoverable.

- **Acceptance:** sign-in and sign-out are reachable from an obvious place; sign-out has
  a confirm step ("confirm dialog before signout" from the old TODOs).
- **Where:** `src/components/site-nav.vue`, main menu, account UI.
- **Status (2026-06-28):** signout confirm dialog shipped (`07d25296`); discoverability polish remains.

### 19. Passkey authentication (WebAuthn) — `feature` · `L` _(added 2026-06-25)_

Add passkeys as the primary, phishing-resistant sign-in. Phone stays as verification/recovery
(see #20/#21), which also solves passkey account-recovery (lost-device).

- **Acceptance:** a user can register a passkey and sign in with it on a supported device;
  a Firebase Auth session results (so Storage rules, `me` identity keep working); revoke/manage
  passkeys from Account; phone remains a recovery path.
- **Architecture:** Firebase has **no native passkey provider** — build a WebAuthn **relying party**
  in `realness-functions` with `@simplewebauthn/server`: callable fns for register-options /
  register-verify / auth-options / auth-verify. Store credentials (id, public key, counter,
  transports) + challenges **server-only** (must be RP-trusted, not user-writable). On a valid
  assertion, mint a Firebase **custom token** (`createCustomToken(uid)`) → client
  `signInWithCustomToken`. No new vendor — keeps the "create your own instance" path self-hostable.
- **Identity wrinkle (open):** today identity is **phone-derived** (`from_e64`, ids like `/+…`),
  and existing users' Storage data is keyed to it. New users/instances are clean; existing
  realness.online users need a **link/migration** (attach a passkey to the current phone-derived
  id, keep the id stable) — don't mint a fresh uid that orphans their data.
- **Couples with:** #5 / the Account redesign (registration + management UI live there).

### 20. Phone validation via Twilio Lookup — `feature/infra` · `M` _(added 2026-06-25)_

Port seeq-app's Twilio **Lookup** services into `realness-functions` to block VoIP / virtual /
throwaway numbers at sign-in (Sybil/fraud resistance) — a _lookup_, not a messaging path.

- **Import from:** `work/seeq-app/functions/javascript/src/services/integrity.js`
  (`validate_phone_integrity`, `check_integrity`), `…/handlers/http/user.js`
  (`check_phone_integrity` callable), the `twilio` dep, `utils/rate-limiter.js`, and the
  `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` params (`defineString` + `defineSecret`).
- **Acceptance:** at sign-in, a number whose Lookup `line_type_intelligence.type !== 'mobile'` or
  whose carrier is on the VoIP blacklist is rejected before an account is created; result cached on
  the user record. Uses Twilio Lookup v2 (`client.lookups.v2.phoneNumbers(n).fetch(...)`).
- **Note:** seeq-app keyed integrity to a Firestore `users` collection — adapt to realness's
  identity model (and the #19 uid). seeq has a `docs/phone-fraud-prevention-plan.md` worth reading.

### 21. Custom app phone number (Twilio Verify) — `infra` · `S` _(consider)_ _(added 2026-06-25)_

Consider a dedicated Realness phone number and sending OTP via **Twilio Verify** rather than
Firebase's pooled numbers — branded sender, deliverability control, decouples verification from
Firebase phone auth (pairs with the custom-token flow from #19).

- **Decision:** keep Firebase phone OTP vs. move to Twilio Verify on an owned number; toll-free vs.
  10DLC-registered long code (US A2P registration applies to the _number_, even for OTP).
- **Acceptance (if pursued):** OTP sends from the Realness number; verify on the same Twilio flow
  that #20's Lookup runs through; cost/registration understood before committing.
- **Depends on:** #20 (same Twilio account/credentials) and the #19 custom-token path.

---

## Phase 3 — Standalone bugs

### 2. PSD export — stroke on shadow layers — `bug` · `M`

PSD export includes stroke info on shadow layers (medium and bold weights) that
shouldn't be there.

- **Acceptance:** exported PSD shadow layers (medium, bold) carry no stroke; other
  layers unaffected; verified by re-opening the export.
- **Where:** PSD export path — _needs locating_ (search export/psd writer in `src`).

### 7. Avatar doesn't render when poster already on page — `bug` · `M`

Avatars fail to render if their poster is already rendered elsewhere on the page; we
need to support **referencing a poster rendered elsewhere**.

- **Acceptance:** an avatar that points at an already-on-page poster renders correctly;
  multiple references to the same poster all render.
- **Likely cause:** SVG `<use>` / duplicate `id` collision when the same poster appears
  twice. **Where:** avatar + poster render components — _needs locating_.

### 14. Main menu inaccessible in 3D mode — `bug` · `M`

- **Acceptance:** the main menu is reachable while in 3D poster mode on desktop and mobile.
- **Where:** 3D view + nav/menu interaction — _needs locating_.

---

## Phase 4 — Mask & canvas

### 12. Unreliable mobile zoom — `bug` · `M` _(do before 11)_

Zoom doesn't work reliably on mobile, so you can't zoom while masking — masking is
"ham-fisted" on mobile.

- **Acceptance:** pinch/zoom works reliably on touch; you can zoom in and mask precisely
  on a phone.
- **Where:** canvas/gesture handling — _needs locating_.
- **Blocks:** #11 being usable on mobile.

### 11. Finish the mask functionality — `feature` · `L`

The mask pen tool exists but is incomplete.

- **Acceptance:** define "done" for masking (full draw/erase, persistence, export into
  the layer model); iPad draw-a-mask from the old TODOs works end to end.
- **Where:** mask pen tool + layer model — _needs locating_.
- **Depends on:** #12 for mobile usability.

---

## Phase 5 — Discoverability & go-to-market

### 10. Design the main app icon — `design` · `M`

The PWA / home-screen icon (`192.png`, `512.png`, maskable).

- **Acceptance:** new icon ships at all required sizes incl. maskable safe-zone; looks
  right installed on iOS and Android home screens; feeds the social preview (#8).
- **Where:** `public/192.png`, `public/512.png`, `scripts/generate-icons.js`,
  manifest in `vite.config.js`.
- **Do before #8** so the share preview uses the final mark.

### 8. Sharable on social media — `feature` · `M`

- **Acceptance:** sharing a Realness marketing URL renders a proper card (title,
  description, image) on the major platforms; preview image uses the final icon/brand.
- **Where:** prerender meta (`src/prerender/`), OG/Twitter tags on the public/marketing routes.
- **Scope note:** marketing surface only — the app stays private (see #9).

### 9. Proper SEO — `feature` · `M`

- **Acceptance:** marketing/About/pricing pages are properly titled, described, and
  crawlable; sitemap/robots correct; the **app itself stays unindexed** per the
  philosophy.
- **Where:** `public/robots.txt`, `public/sitemap.xml`, `src/prerender/`.
- **⚠ Tension to resolve:** the README states "no SEO, unindexed by search engines."
  Confirm the split — SEO on marketing pages, app private. **Needs a decision.**

### 16. "Create your own Realness" CTA — `feature/copy` · `S`

A button with prompt copy inviting a user to stand up their own instance.

- **Acceptance:** a clear CTA + copy on the public site pointing at the self-host path
  (README clone-and-install / contributing).
- **Where:** `src/components/call-to-action.vue`, `src/components/sponsor/cta.vue`, About.
- **Pairs with:** the copywriting skill.

---

## Phase 6 — Platform features (after the launch-critical work)

### 1b. PWA share target — `feature` · `M`

Register Realness to receive **images from the OS share sheet** so a shared photo opens
straight into the tracer.

- **Acceptance:** Realness appears in the OS share sheet for images; sharing a photo to
  it lands the file in the app and runs it through the vector pipeline.
- **Where:** add `share_target` (POST, `multipart/form-data`, `files: image/*`) to the
  manifest in `vite.config.js`; add a service-worker handler that pulls the file from
  `formData`, stashes it (Cache/IndexedDB), and redirects to a `/share-target` landing
  route. Current PWA uses `generateSW`, so the POST handler needs `importScripts` or a
  runtime route.

### 18. Verify (instance verification) — `feature` · `L`

Build the "verify any instance" tooling the README and `verify-release.md` already
promise (extends the shipped build-manifest work).

- **Acceptance:** a `/verify` page and/or CLI lets anyone confirm a running instance
  matches a trusted release; write the missing `docs/verify-instance-plan.md`.
- **Where:** `scripts/verify-deploy.js`, `scripts/build-manifest.js`, a new `/verify`
  route, `realness/docs/verify-instance-plan.md`.

---

## Infra (anytime, parallel)

### 3. Email for realness.online — `infra` · `S` ✅ **DONE 2026-06-28**

Stand up domain email to **send and receive** as a single `realness.online` address (iCloud+
Custom Domain; public/security contact `security@realness.online`).

- **Done:** domain verified in iCloud; DNS at Hover correct + propagated (mx01/mx02.mail.icloud.com,
  SPF, DKIM, apple-domain); `scott@realness.online` created; catch-all ON; `public/security.txt`
  points at `security@realness.online` (committed `fb8fadc8`); `security@` address created, test sent,
  `security.txt` published via deploy.

---

## Open decisions (resolve while executing)

1. **SEO/social scope** (#8, #9) — confirm marketing-pages-only vs. app-private split.
2. **Legal** (#13) — outside counsel? timeline?
3. **Passkeys** (#19) — does passkey _replace_ phone login or sit alongside it (phone = recovery)?
   How to **migrate existing phone-derived `/+…` identities** without orphaning Storage data?
4. **Custom number** (#21) — Firebase phone OTP vs. Twilio Verify on an owned number; toll-free
   vs. 10DLC.

---

## Checklist

**Money & legal**

- [~] 13. Legal — **TOS + Privacy + clickwrap + LICENSE built into the app 2026-06-28** (`/terms`, `/privacy`, consent at sign-up); now in **attorney-review** state. Remaining = human/legal gates: counsel review, DMCA agent registration, E&O/cyber insurance, DBA, checkout/ARL. See #13 + `realness/docs/legal/attorney-review.md`.

**Account & auth** _(one coupled redesign — see #5)_

- [ ] 5. Refactor sign-in page _(inline fold + signout confirm shipped; polish remains)_
- [ ] 6. Require a name
- [ ] 15. Sign in / out discoverability _(signout confirm shipped)_
- [ ] 19. Passkey authentication (WebAuthn RP in functions + custom token)
- [ ] 20. Phone validation via Twilio Lookup (port from seeq-app)
- [ ] 21. Custom app phone number / Twilio Verify _(consider)_

**Bugs**

- [ ] 2. PSD export stroke on shadow layers (medium & bold)
- [ ] 7. Avatar render when poster already on page
- [ ] 14. Main menu inaccessible in 3D mode

**Mask & canvas**

- [ ] 12. Reliable mobile zoom (blocks 11)
- [ ] 11. Finish mask functionality

**Discoverability & GTM**

- [ ] 10. Design main app icon
- [ ] 8. Sharable on social media
- [ ] 9. Proper SEO (marketing surface)
- [ ] 16. "Create your own Realness" CTA + copy

**Platform features**

- [ ] 1b. PWA share target (receive images)
- [ ] 18. Verify (instance verification) + write verify-instance-plan.md

**Infra**

- [x] 3. Email for realness.online — `security@` created, test sent, `security.txt` published _(done 2026-06-28)_
