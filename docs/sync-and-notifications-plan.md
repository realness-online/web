# Sync and Notifications Plan

A plan for syncing optimizations, global feed architecture, and notification design with anti-addiction considerations.

## Context

- Users may stay on the Thoughts view for days without reloading
- PWA on home screen: `visibilitychange` fires on every app switch
- Moving to a global feed: no more stranger deletion
- Goal: reduce sync load, add push notifications, avoid addictive patterns

---

## 1. Sync Optimizations

### Short-circuit `sync_offline_actions`

When `sync:offline` is empty and the user is signed in, skip the anonymous-poster block and `build_local_directory`. Avoids calling `keys()` on every tab/app switch.

### Remove prune

- Stranger deletion is going away (global feed)
- Hash comparison for our data is redundant: `sync_me`, `sync_relations`, `sync_statements`, `sync_events` already handle their own invalidation
- Hash comparison for feed/posters from others would be expensive with a global feed; not worth it
- **Action:** Remove prune or reduce to directory cleanup only

### Keep existing `sync_time` gate

The 8-hour `i_am_fresh()` check already gates the heavy sync path. No change needed.

---

## 2. Global Feed

**No relations.** Everyone gets the same feed. Small social network (~200 users).

### Server as index (pragmatic path)

- **Current:** Server holds both index and content. P2P mesh isn't reliable enough yet.
- **Next:** Add server-as-index. Firestore holds lightweight entries: `(itemid, hash, author, timestamp, type)`.
- **Later:** As P2P grows, content can come from peers; index stays on server.
- Server-as-index can scale to hundreds of thousands of users (see Section 8).

### Storage trigger

On Firebase Storage write (`onObjectFinalized`):

- Parse path for author, type, timestamp
- Optionally parse HTML for preview/metadata (see below)
- Write to Firestore `feed_index` collection

### User doc: last_signed_in

- Store in `/{phone}/index.html` (user profile document)
- Updated on sign-in and on successful sync
- Drives "what's new since X" — filter directory/index by `updated > last_signed_in`
- Simple time filter; no complex delta/consensus (avoid TigerBeetle territory)

### Directory metadata

- Per folder: list of `(itemid, updated)` from Storage metadata
- Infer item info from path + metadata; no extra feed index needed at first
- Request: `list_directory_since(path, since)` → items updated after `since`

### HTML parsing in Cloud Functions

Use **cheerio** for parsing HTML in Node.js. It's jQuery-like and lightweight, good for extracting structured content from the microdata (`itemscope`, `itemid`, `itemprop`) stored in our HTML.

Path-derived data (author, type, timestamp) may be sufficient without parsing. Parse HTML only when you need preview text, author display name, or thumbnails.

### Scheduled notification job

- Runs every 15–60 minutes (not a single global time)
- For each subscriber: check conditions before sending
- On send: update `last_notified_at`

---

## 3. Notification Logic (Anti-Addiction)

### Per-user cadence

- Only send if `now - last_notified_at >= 8 hours`
- Optional: randomize ±30 min to avoid feeling like a scheduled habit

### Quiet hours (timezone-aware)

- Store user timezone with subscription (e.g. `Intl.DateTimeFormat().resolvedOptions().timeZone`)
- Before send: convert `now` to user's local time
- Skip if within quiet window (e.g. 10pm–8am)
- Optional: make window a user preference

### Cooldown after opens

- When app becomes visible: send `last_opened_at` heartbeat to backend
- Before send: skip if `now - last_opened_at < cooldown` (e.g. 2 hours)

### Content threshold

- Only notify if there's meaningful new content (e.g. ≥3 posts) since last check

### Preference to disable

- `notifications_enabled` boolean per user
- If disabled, never send

### Send order (gate checks)

1. `notifications_enabled`
2. Outside quiet hours
3. Outside cooldown
4. Cadence (8h+ since last)
5. Content threshold met

---

## 4. Client Changes

### Thoughts UI: load global feed when it changes

When the feed changes while the app is open (e.g. sync completes, user returns to tab), the Thoughts view must refresh and show new content.

**Implementation:** Sync emits `refreshed` when `play()` completes. App provides `feed_needs_refresh` ref, updated on that emit. Thoughts injects it, watches it, and calls `fill_statements()` when it changes. This lets the feed update without a full page reload.

### Push subscription

- Request permission, get subscription, send to backend with timezone
- Backend stores subscription per user

### On app open / visibility

- Send `last_opened_at` heartbeat for cooldown logic

### Preferences UI

- Toggle to enable/disable notifications
- Optional: quiet hours window, cadence (8h / 12h / 24h)

---

## 5. Future Consideration: HTTP Cache

For feed/posters from others, HTTP cache or Cache API could replace or complement IndexedDB. Would reduce client work and simplify cache invalidation. Depends on Firebase Storage metadata and load paths.

---

## 6. WebRTC Mesh (Idea)

P2P feed and content over WebRTC. Simplified model: list of folders + directory metadata.

### Simplified protocol

- **Index** = list of folder paths that make up the feed (one global set for everyone)
- **list_folder(path)** → `[itemid1, itemid2, ...]` (or with metadata: `updated`)
- **get_item(itemid)** → HTML content
- No complex delta sync; just "what's in the folder" and "give me this item"

### If there's no peer, build it

- Fetch from server (Firebase Storage), store in IndexedDB
- You become the seeder for others
- Server is fallback; each client that fetches becomes a new seed
- Natural scaling: more users → more P2P, less server load

### realness.local as seeding peer

- Laptop at realness.local has synced content in IndexedDB
- Acts as seeder: answers `list_folder` and `get_item` over WebRTC
- Admin-only login when `hostname === 'realness.local'` — secures the seeding peer on LAN

### Signaling

- **LAN (realness.local):** WebSocket server on laptop. Node process.
- **Remote (realness.online):** Firebase Firestore or Realtime DB for SDP/ICE.
- Abstract signaling layer; same WebRTC logic, swap transport by context.

### Shared room per user

- Room ID = derived from `me`
- All of the user's devices join the same room
- Any device with content can seed
- Full mesh for 2–5 devices is manageable

### Content fallback

- When no peer has an item: fetch from Firebase Storage
- Server stays inert; mesh reduces its load when peers are available

---

## 7. Scale Limits and Paths

### Simple model: ~200 users

- One global feed, any peer can seed the whole thing
- Single directory listing; "since last_signed_in" keeps responses small
- No sharding needed

### Scaling beyond 200

| Approach                | When                                                        |
| ----------------------- | ----------------------------------------------------------- |
| Hot/archive split       | 500–1k users. Recent content in hot path; older in archive. |
| Shard by author         | 1k–5k users. Peers hold subsets.                            |
| More always-on seeders  | Community-run nodes.                                        |
| Federation              | Multiple instances, each ~200, optionally synced.           |
| DHT / content-addressed | 5k+ users. IPFS-style.                                      |

---

## 8. Server-as-Index Scale

Firestore (or equivalent) holding only the index — `(itemid, hash, author, timestamp, type)` — can scale to:

- **Hundreds of thousands of users** with proper indexing and pagination
- Index size: ~100 bytes per item; 10M items ≈ 1GB
- Read cost: 1–5 queries per session; Firestore handles millions of reads/day
- Content stays on mesh or Storage; index is the lightweight coordination layer

---

## Summary

| Area                 | Action                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| sync_offline_actions | Short-circuit when empty + signed in                                                  |
| prune                | Remove (stranger deletion obsolete; hash check redundant)                             |
| global feed          | No relations; everyone gets same feed; ~200 users for simple model                    |
| server as index      | Add Firestore index; content from server now, mesh later when P2P grows               |
| last_signed_in       | In user doc `/{phone}/index.html`; drives "since X" filter                            |
| directory metadata   | list_directory_since(path, since); infer item info from path                          |
| feed index           | Storage trigger → Firestore; use cheerio for HTML when needed                         |
| notifications        | Per-user cadence, quiet hours, cooldown, disable preference                           |
| client               | Push subscription, heartbeat, preferences UI                                          |
| WebRTC mesh          | Simplified: list_folder + get_item; no peer = build from server; shared room per user |
| scaling              | Hot/archive, sharding, federation at higher scale; server-as-index to 100k+ users     |

---

## Next steps (when returning)

1. **Server-as-index** — Add Firestore feed_index; Storage trigger populates it. Client fetches index since last_signed_in.
2. **last_signed_in** — Add to user doc `/{phone}/index.html`; update on sign-in and sync completion.
3. **Simplify client feed** — Build feed from index; remove relations-derived logic.
4. **WebRTC** — When ready: WebSocket signaling for realness.local; shared room; list_folder + get_item protocol. Try peers first, fallback to Storage.
