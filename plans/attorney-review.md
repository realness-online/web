# Realness — Legal Layer: Attorney Review Package

_Prepared 2026-06-28 for first-pass attorney review. **Not legal advice.** Every
finding below is flagged for a licensed California attorney to confirm, revise,
or reject before these documents go live or the Service charges money._

This package covers the three user-facing legal documents now built into the
hosted Service at realness.online:

- **Terms of Service** — `src/content/terms.md`, rendered at `/terms`
- **Privacy Policy** — `src/content/privacy.md`, rendered at `/privacy`
- **Source-Available License** — `/LICENSE` (developer-facing; reviewed here for
  consistency with the Terms, not re-drafted)

Assent is captured as **clickwrap** at sign-up: the phone form shows "By
continuing you agree to the Terms and Privacy Policy" with links, immediately
above the "Text me a code" button (`src/components/profile/as-form-mobile.vue`).

---

## DOCUMENT SUMMARY

```
Document Type:      Consumer Terms of Service + Privacy Policy (SaaS / UGC)
Parties:            Scott Fryxell (sole prop, dba "Realness") and each end user
Our Client:         Scott Fryxell — operator of the hosted Service
Date:               Drafted 2026-06-28; "Last updated June 28, 2026"
Jurisdiction:       California, USA (governing law + arbitration venue)
Review Purpose:     Pre-launch first pass before attorney sign-off
```

### Key terms at a glance

| Term                     | Position taken in the draft                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| Eligibility              | 13+; under-18 requires parent/guardian involvement                               |
| Identity                 | Phone-number-derived; OTP verification                                           |
| User content             | User owns; grants operator a license to host/display to run the Service          |
| Outputs                  | User owns; commercial use allowed on all tiers incl. free                        |
| Commercial tiers         | Personal free · Teams $100/yr · Orgs $500/yr (per `/pricing`)                    |
| Billing                  | Annual, auto-renew, 14-day refund window, taxes on customer                      |
| Liability cap            | Greater of 12-mo fees paid or **US $100**                                        |
| Dispute resolution       | Binding individual arbitration in CA + class-action waiver + 30-day opt-out      |
| Governing law            | California                                                                       |
| DMCA                     | Notice-and-takedown to `security@realness.online` (agent **not yet registered**) |
| Sub-processors disclosed | Google Firebase (auth/storage/hosting), Google reCAPTCHA                         |

---

## FLAGGED ITEMS — RISK ANALYSIS

### 🔴 HIGH — confirm before going live

~~**H-1 · DMCA designated agent not registered.**~~ **RESOLVED — deferred.**
The Terms invoke DMCA safe harbor and name `security@realness.online` as the
agent, but §512 safe harbor requires registering a designated agent with the
U.S. Copyright Office (and a $6 filing). Moved to `parked.md` — not worth
the paperwork until there are users posting content.

~~**H-2 · Arbitration + class-action waiver enforceability.**~~ **RESOLVED — removed.**
Arbitration clause and class-action waiver were removed from Terms §14 per
operator decision. Replaced with a simple governing-law/venue clause. No longer
a risk item.

~~**H-3 · Clickwrap assent sufficiency.**~~ **RESOLVED — no arbitration to enforce.**
The sign-in-wrap concern was tied to arbitration/waiver enforceability. Without
an arbitration clause, sign-in-wrap is industry standard and sufficient. No
change needed.

**H-4 · Liability cap floor may be too low to be the real backstop.**
Cap is the greater of 12-mo fees or $100. For free-tier users the cap is $100,
which is fine for Scott — but the _practical_ protection per the strategy is
insurance, not the cap. Confirm the cap language survives and pairs with E&O /
cyber coverage actually in force.
→ _Action: line up tech E&O / cyber insurance; confirm cap wording._

### 🟡 MEDIUM — review and likely adjust

**M-1 · Children / COPPA posture.** Age floor is 13 (COPPA boundary), not
knowingly collecting under-13 data. Because the Service collects a **phone
number** as core identity, confirm 13–15 handling and whether any
age-gate/verification beyond self-attestation is advisable.

**M-2 · Sub-processor list completeness.** Only Google Firebase + reCAPTCHA are
disclosed (matches current code). The finishing-touches plan contemplates
**Twilio** (Lookup #20, Verify #21). If/when Twilio ships, the Privacy Policy
sub-processor list and the Terms §10 must be updated **before** any phone data
flows to Twilio.

**M-3 · CCPA/CPRA "do not sell/share" representation.** The Privacy Policy
states we don't sell or share. reCAPTCHA's data flows to Google; confirm this
doesn't constitute "sharing" for cross-context behavioral advertising under
CPRA, and that no "Do Not Sell/Share" link is required.

**M-4 · Refund window & auto-renewal compliance (CA ARL).** California's
Automatic Renewal Law has strict disclosure, affirmative-consent, and
easy-cancel requirements for auto-renewing subscriptions. The Terms set
annual auto-renew + 14-day refund; the **purchase flow UI** must also meet ARL
(clear disclosure near the pay button, cancellation method).
→ _Note: the paid tiers currently route to "Contact us," so no self-serve
checkout exists yet — ARL UI obligations attach when checkout is built._

**M-5 · Content license scope/survival.** The license to host Your Content ends
on deletion "except for routine backups for a limited period." Confirm "limited
period" is acceptable or should be a defined number of days.

**M-6 · Indemnification is one-directional (user → operator).** Standard for a
free consumer service. Confirm no mutual indemnity is expected for the paid
org tier.

**M-7 · Governing-law / consumer-rights interaction.** CA law + arbitration is
chosen, but non-US/non-CA users retain some non-waivable local rights (e.g.
EU/UK if the Service is used there). Confirm whether to geo-limit, add an EU
addendum, or accept the exposure given the US-only operational posture.

### 🟡 MEDIUM — substantive legal theory worth examining

**M-8 · "Original content" defense — poster-as-transformative-work.**
The trace pipeline converts a bitmap photo into a layered vector poster via
Potrace polygon-mode vectorization + hierarchical cutout decomposition. The
source photo never leaves the device. The output preserves composition
(subject positioning, framing) but strips photographic texture, continuous
tones, fine detail, and lighting. A legal theory worth examining: the poster
is so visually and structurally different from the source photo that it
qualifies as a new, original work — either because no protected expression
survives (no substantial similarity) or because the transformation is
sufficient for fair use.
→ _Assessment needed: does the preserved composition convey enough protected
expression to create derivative-work liability? How does Warhol v. Goldsmith
(2023) apply — does the poster serve a "different purpose" from the original
photo, or could it compete in the same market (art prints)? Should the Terms
or documentation address this defense or rely on §230 + DMCA as the sole
liability framework?_

### 🟢 LOW — note for awareness

- **L-1 · "dba Realness" / DBA filing.** Docs identify Scott Fryxell dba
  Realness. Confirm whether a California **FBN (DBA)** filing is required for the
  name as used commercially.
- **L-2 · Entire-agreement vs. the separate LICENSE.** Terms §16 says Terms +
  Privacy are the "entire agreement" about the _hosted Service_, while the
  LICENSE governs the _software_. Confirm the two-document split reads cleanly
  and there's no gap/overlap on the commercial-tier obligations (Terms §6 vs.
  LICENSE §4).
- **L-3 · "Last updated" dating / versioning.** Both docs carry a manual date.
  Consider a change-log or version note for future material changes (ties to the
  notice obligations in Terms §15 / Privacy "Changes").

---

## MISSING / ABSENT TERMS ⚠️ (silence is not neutrality)

- [ ] **Designated DMCA agent registration** (see H-1) — referenced, not filed.
- [ ] **Self-serve checkout + ARL-compliant purchase UI** — paid tiers are
      "Contact us" today; renewal/refund/tax mechanics in Terms §7 presuppose a
      billing flow that doesn't exist yet.
- [ ] **Cookie/tracking notice granularity** — covered at a high level; confirm
      reCAPTCHA cookie disclosure is sufficient or needs a dedicated line.
- [ ] **Data Processing Addendum / GDPR basis** — none; acceptable only if the
      Service is positioned US-only (see M-7).
- [ ] **Insurance in force** — the protection strategy names E&O/cyber as the
      real backstop; not a document, but the gating real-world item (H-4).
- [ ] **Accessibility / acceptable-content appeal path** — optional; consider a
      moderation-appeal line for fairness and ADA posture.
- [ ] **Transformative-work / fair-use defense** — the posters are derived from
      user-supplied photos; the platform and its users have an interest in
      whether the vector output is a new original work or a derivative. Not
      addressed in any current document (see M-8).

---

## CONSISTENCY CHECK — Terms ↔ Privacy ↔ LICENSE

| Point                                    | Terms | Privacy                         | LICENSE | Aligned?                         |
| ---------------------------------------- | ----- | ------------------------------- | ------- | -------------------------------- |
| Governing law = CA                       | §14   | "California"                    | §11     | ✅                               |
| Commercial tiers / responsibility        | §6    | —                               | §4–5    | ✅ (cross-references `/pricing`) |
| Phone-derived identity + deletion/export | §3    | "Phone-number-derived identity" | —       | ✅                               |
| Source photo never uploaded              | §2    | "What we do not collect"        | —       | ✅                               |
| Sub-processors                           | §10   | "Service providers"             | —       | ✅ (Firebase + reCAPTCHA)        |
| Self-host responsibility transfer        | §6    | —                               | §5      | ✅                               |
| Liability disclaimer                     | §11   | —                               | §9      | ✅                               |

No contradictions found between the three documents as drafted.

---

## RECOMMENDED NEXT STEPS (prioritized)

1. ~~**H-2 · Arbitration**~~ ✅ Removed. ~~**H-3 · Clickwrap**~~ ✅ No longer a concern.
   ~~**H-1 · DMCA registration**~~ → deferred. All original 🔴 items resolved or
   deferred per operator decisions.
2. **H-4 / Insurance** — bind tech E&O / cyber when there are active users or
   revenue. Defer for now.
3. **Confirm CA ARL obligations** and defer the renewal/refund clauses' UI until
   self-serve checkout is built.
4. **Re-run this review when Twilio is added** (M-2) and when checkout ships.
5. **Resolve open decisions** from the finishing-touches plan #13: outside
   counsel engaged? FBN/DBA filing? §230 posture confirmed?
6. **Assess the transformative-work defense** (M-8) — confirm whether to
   document the poster-as-original-work theory in the Terms or leave the
   liability framework to §230 + DMCA only.

```

```
