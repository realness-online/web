# Realness – Security

![Realness](/public/icons.svg)

This is the security and threat-model counterpart to
[philosophy.md](./philosophy.md) and [architecture.md](./architecture.md). It
exists so the reasoning behind Realness's security posture doesn't have to be
re-derived every time. If a decision here seems surprising, read it as
**deliberate** — most of Realness's security comes from what it refuses to
centralize.

## The shape: ~90% client, an inert server

Realness is a client-only, offline-first PWA. The "heavy lifting" — identity,
posters, thoughts, events, avatars, vector tracing — happens on device. Data
lives in the user's own Firebase Storage directory, plus `localStorage` /
IndexedDB on device.

The server (`realness-functions`) is **optional.** It exposes HTTP capabilities
the app probes at runtime (`push`, `phone_integrity`) plus a scheduled push
broadcaster. Instances without it are fully client-only. Stripe sponsorship uses
hosted checkout only — no application server required.

**Security consequence:** the attack surface that usually matters most — a
central application server holding everyone's data and logic — does not exist
here. There is little to point an attack _at_.

## Dispersed by design: small targets, not one honeypot

Realness is meant to be **run by communities**, each its own instance (its own
Firebase project, its own moderator). The ideal is that realness.online is a
reference implementation plus a thin demo instance — **not** a central authority
that everyone signs in to.

This is a security stance, not just an aesthetic one: **blast-radius
reduction.** A centralized platform is a honeypot — one breach exposes everyone.
A dispersed set of small community instances has no jackpot — breach one and you
get one small community, not the world. Aggregation is the enemy; dispersion is
the defense.

> **Honest caveat:** this benefit is a function of _adoption_. Today there is
> effectively one instance, so the current risk profile is still centralized.
> The small-targets property only materializes as people actually run their own
> (see the "create your own Realness" CTA and instance-verification work). We
> hold the decentralized _intent_ with a still-centralized _reality_.

## Phone numbers: the load-bearing primitive

Phone numbers do three jobs at once. Understanding all three prevents "let's
just drop phone" mistakes.

1. **Identity.** Identity is phone-derived (`from_e64`, ids shaped like
   `/+<e164>`). Storage security rules authorize directly off the auth token:

   ```
   match /people/{mobile}/{path=**} {
     allow write, delete: if request.auth != null
       && request.auth.token.phone_number == mobile;
   }
   ```

   The phone number is the **primary key of the data model and the claim every
   rule checks** — not just a login.

2. **A Sybil gate.** A phone number is scarce and costs something to obtain at
   scale (a normal person has one or two; a thousand requires a thousand SIMs or
   a VoIP service). That friction is the barrier to mass fake-account creation.
   Twilio **Lookup** (`line_type_intelligence`) hardens it by blocking
   VoIP/virtual numbers at sign-in. See [Sybil resistance](#sybil-resistance).

3. **A decentralized contact substrate.** In a dispersed model with no central
   server, the phone network is the one shared, un-owned layer everyone already
   has. Basing contact on phone numbers is **federation without a federation
   protocol** — the same instinct as email-as-identity on the old web.

### Phone numbers are low-secrecy but high-leverage

A phone number is **not a secret** (people you call see it; it's in directories)
— which is exactly why it's a poor _authentication secret_ and why SMS 2FA is
deprecated. But "not secret" ≠ "not sensitive." A number is the **master key to
everyone else's accounts** (SMS reset + SIM-swap) and a **permanent,
un-rotatable identity correlator**. The risk is **aggregation** (a harvestable
list of many numbers) and **per-number leverage** (one number's SIM-swap value),
not confidentiality.

- **Aggregation risk** is defeated by dispersion (small per-instance sets,
  trusted communities).
- **Per-number risk** does not disperse — so phone-as-contact must be **opt-in
  and consent-gated**, never a public field. See
  [Messaging](#messaging-handoff-not-a-silo).

## Authentication

Realness uses **Firebase phone auth**. It is built-in, and — importantly for the
dispersed model — **lighter to self-host than the alternatives**: each instance
is just its own Firebase project, no custom auth code to run and operate.

**Passkeys (WebAuthn) are an optional per-instance enhancement, not a
replacement.** If an instance wants them, the integration is: a WebAuthn relying
party in the instance's functions (`@simplewebauthn/server`) verifies the
ceremony, then mints a Firebase **custom token** (`createCustomToken(uid)`) →
client `signInWithCustomToken` → a normal Firebase session that the existing
`onAuthStateChanged` plumbing and Storage rules consume unchanged. Custom tokens
let the RP **choose the `uid`**, so a passkey can link to an existing
phone-derived id without orphaning data.

**Why not passkey-only?** Passkeys are more secure _per account_ (phishing- and
SIM-swap-resistant) but they are free and unlimited to create — so they **remove
the Sybil gate** phone provides, and a per-instance RP is **more** for
self-hosters to run, not less. Account-takeover resistance (better with
passkeys) and abuse/Sybil resistance (worse without phone) are different axes;
don't conflate them.

## Messaging: handoff, not a silo

Realness does **not** build messaging. It is a **doorway into the intimate
channels people already have** — iMessage, Signal, WhatsApp, group chats with
people they already trust — and then it gets out of the way. A central in-app
inbox would be the opposite of intimate: a silo to host, surveil, moderate, and
breach. Realness is a **connector, not a roach motel** — it deliberately sends
people _out_ into warmer, private, self-moderating spaces (this is why there are
no likes, no comments, no engagement games).

The primitive that makes this both safe and intimate is a **consent handshake**:
a number or chat-link is revealed **only after mutual consent** (a follow-back /
accepted request / shared community). This one rule does three things at once:

- **Intimacy is consensual by definition** — you're only dropped into a chat
  someone wanted you in.
- **The harvest problem disappears** — no number is exposed to anyone not
  already accepted, so a fake account has nothing to scrape.
- **It stacks with the Sybil gate** — fakes are costly to mint _and_ can reach
  no one without consent. Two locks, same warm feature.

## Sybil resistance

Account-takeover security protects _one_ account; **Sybil resistance** stops
_one actor from minting many_. They are separate problems. Realness's gate is
layered:

- **Phone friction** — costs something to mint at scale (primary gate).
- **Twilio Lookup** — blocks VoIP/virtual numbers at sign-in (ported pattern;
  see seeq-app's `phone-fraud-prevention-plan.md`).
- **Moderation** — moderators are at the center of Realness by design; they keep
  instances human and catch what slips through.
- **Payment** (voluntary) — the sponsor tier is a voluntary license purchase with
  anonymous Stripe checkout; Stripe collects email on every transaction for
  receipt and refund purposes. Not a Sybil gate — anyone can pay without an
  account.

## Data & trust boundaries

- **Client → Firebase Storage.** The app reads/writes the user's own Storage
  directory. Rules authorize on `request.auth.token.phone_number` matching the
  path. No Firestore on the client.
- **Functions → Firestore.** `realness-functions` uses Firestore (e.g.
  `sponsorships`) and is Stripe-only. Server-trusted data (e.g. any future
  passkey credentials) belongs here, **server-only** — never in client-writable
  Storage.
- **Third parties.** Firebase (auth + storage hosting), Stripe (payments),
  Twilio (optional Lookup at sign-in when `realness-functions` has credentials —
  a _lookup_, not ongoing messaging). The phone number is shared with
  Firebase/Twilio for authorization; this is stated plainly in philosophy.md.

## What we explicitly accept

- **Free signup is frictionless beyond the phone gate.** We lean on phone
  friction + moderation (+ optional payment) rather than identity verification
  or invasive proof-of-personhood.
- **Centralized-today, dispersed-intended.** The honeypot-avoidance benefit
  grows with self-host adoption; we accept the centralized risk profile until
  then.
- **Per-number leverage exists.** We mitigate by never exposing numbers publicly
  (consent-gated contact only), not by pretending numbers are harmless.

## Reporting

Vulnerability reports: see [`/public/security.txt`](/public/security.txt) (RFC
9116). Contact: `security@realness.online`.
