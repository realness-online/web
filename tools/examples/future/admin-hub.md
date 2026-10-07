# Future example: personal admin hub

For a person who wants one place to manage their Brayness work.

Each person can build and publish their own hub. This example is a starting
point, not a fixed system admin page.

## What

- Show the owner's harnesses, published apps, and active loops.
- Open chat or the canvas terminal for a harness.
- Stop an owned loop after confirmation.
- Keep controls limited to the signed-in owner's resources.

## Done when

A signed-in owner can publish a hub, open their work, and stop one of their
loops. A different owner cannot read or control it.

## Open questions

- Which owner-facing endpoints should published apps use?
- Can owners customize the hub without rebuilding it?

## What it needs from Brayness

- Owner-scoped access to harnesses, apps, and loop state.
- A safe path from a published app to chat and terminal.
