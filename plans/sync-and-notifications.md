# Sync and Notifications

Status: active
Related: finishing-touches — notification opt-in; platform verify push (adjacent)

## Goal

Make feed sync server-indexed and durable across sessions, then simplify the client feed.
Keep a clear path to peer sync (WebRTC) without blocking the index work.

## Current state

Client feed still leans on relations-derived logic. No Firestore `feed_index` yet.
`last_signed_in` is not driving incremental fetch. WebRTC for realness.local is not started.
Notification opt-in UI still lives in Account settings (see finishing-touches).

## Approach

1. **Server-as-index** — Add Firestore `feed_index`; Storage trigger populates it. Client
   fetches index since `last_signed_in`.
2. **last_signed_in** — Add to user doc `/{phone}/index.html`; update on sign-in and sync
   completion.
3. **Simplify client feed** — Build feed from index; remove relations-derived logic.
4. **WebRTC** — When ready: WebSocket signaling for realness.local; shared room;
   `list_folder` + `get_item` protocol. Try peers first, fallback to Storage.

## Out of scope

- Full notification product design (cadence copy belongs in finishing-touches onboarding).
- Replacing Firebase OTP or passkeys (see `parked.md`).

## Verification

- Index populates from Storage writes; client load after sign-in only pulls newer entries.
- Feed matches prior relations-derived results for a known account fixture.
- WebRTC path: peers exchange `list_folder` / `get_item`; Storage used only on peer miss.
