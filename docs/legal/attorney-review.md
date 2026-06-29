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

**H-1 · DMCA designated agent not registered.**
The Terms invoke DMCA safe harbor and name `security@realness.online` as the
agent, but §512 safe harbor requires registering a designated agent with the
U.S. Copyright Office (and a $6 filing). Until registered, the safe-harbor
defense the Terms rely on is not perfected.
→ _Action: register the DMCA agent; confirm the address/role wording matches the
registration._

**H-2 · Arbitration + class-action waiver enforceability.**
This is the single biggest liability lever and the most scrutinized clause for a
consumer service. Enforceability depends on conspicuous presentation, a
compliant opt-out, and current CA/9th-Cir. consumer-arbitration law (mass/batch
arbitration, fee provisions). A 30-day email opt-out is included.
→ _Action: attorney to confirm the clause, the opt-out mechanics, and whether to
name a specific arbitration provider/rules and address arbitration fees._

**H-3 · Clickwrap assent sufficiency.**
Assent is "by continuing you agree" above the action button (sign-in wrap), not
an unchecked checkbox. Courts increasingly favor explicit affirmative assent for
enforceability of arbitration/waiver.
→ _Action: attorney to decide whether a checkbox ("I agree to the Terms and
Privacy Policy") is warranted given H-2. Easy to add in `as-form-mobile.vue`._

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

1. **Attorney review of H-1…H-4** (DMCA registration, arbitration/waiver,
   clickwrap form, liability cap) — these gate go-live.
2. **Register the DMCA designated agent** with the U.S. Copyright Office.
3. **Bind tech E&O / cyber insurance** — the practical backstop behind the cap.
4. **Decide checkbox vs. sign-in-wrap** for assent; trivial to implement.
5. **Confirm CA ARL obligations** and defer the renewal/refund clauses' UI until
   self-serve checkout is built.
6. **Re-run this review when Twilio is added** (M-2) and when checkout ships.
7. **Resolve open decisions** from the finishing-touches plan #13: outside
   counsel engaged? FBN/DBA filing? §230 posture confirmed?

```

```
