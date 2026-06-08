## Next steps (when returning)

1. **Server-as-index** — Add Firestore feed_index; Storage trigger populates it. Client fetches index since last_signed_in.
2. **last_signed_in** — Add to user doc `/{phone}/index.html`; update on sign-in and sync completion.
3. **Simplify client feed** — Build feed from index; remove relations-derived logic.
4. **WebRTC** — When ready: WebSocket signaling for realness.local; shared room; list_folder + get_item protocol. Try peers first, fallback to Storage.
