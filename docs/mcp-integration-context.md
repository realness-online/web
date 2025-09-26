# MCP Integration Context for Realness

## Overview

- **Goal:** Make Realness's main products—Thoughts (posters and statements)—available via MCP (Multi Cursor Protocol).
- **Motivation:** Enable designers and developers to export/import Thoughts to local tools (file system, Blender, Illustrator, etc.) and facilitate real-time or on-demand data exchange.

## Data Model

- **Thoughts:** Unified concept aggregating posters (SVG-based) and statements (text/content).
- **Structure:**
  - `id` (itemid)
  - `type` (poster or statement)
  - `microdata` (HTML/DOM structure, itemid, itemtype, itemprop)
  - `content` (SVG for posters, text for statements)
  - `metadata` (timestamps, author, EXIF/location, etc.)
- **Source:**
  - <a href="src/components/as-days.vue">as-days.vue</a> and as_thoughts utility provide the iterable, normalized structure for Thoughts.
  - <a href="src/utils/item.js">item.js</a> and <a href="src/utils/itemid.js">itemid.js</a> handle extraction, validation, and microdata parsing.

## Export/Integration Requirements

- **Canonical export format:**
  - JSON object containing all relevant fields (see above).
  - Preserve microdata and metadata for downstream use.
- **MCP Bridge:**
  - Utility/module in Realness to send (and eventually receive) Thoughts over MCP.
  - Extensible for future use cases (e.g., Blender scene generation, Illustrator import).
- **UI/Trigger:**
  - Export action (button/menu) to trigger MCP export of Thoughts.

## WebRTC Focus

- **Purpose:**
  - Use WebRTC as the transport layer for peer-to-peer communication between Realness (PWA) and local applications (Cursor, plugins, etc.).
  - Enable real-time or on-demand export/import of Thoughts.
- **Considerations:**
  - Define signaling and message format for WebRTC/MCP.
  - Ensure data integrity and type safety (leverage existing item.js/itemid.js logic).

## Progress So Far

### ✅ Step 1: WebRTC Peer Connection Setup

- **Connection Dialog:** Created <a href="src/components/connection/as-dialog-connection.vue">as-dialog-connection.vue</a>
  - Supports two modes: Shared Account (`realness-{phone_number}`) and Local Only (`realness-local`)
  - Displays connection info with room ID, ICE servers, and MCP capabilities
  - Copy-to-clipboard functionality for connection info
- **Key Command Integration:** Added `ui::Show_Connection` command bound to `U` key
  - Integrated into <a href="src/App.vue">App.vue</a> following existing dialog patterns
  - Added to <a href="src/utils/keymaps.js">keymaps.js</a> Global context
- **UI/UX:** Follows established patterns with semantic HTML and element-based CSS inheritance

### 🔄 Step 2: Signaling Protocol (Next)

- **Status:** Ready to implement
- **Requirements:**
  - Define signaling mechanism for peer connection setup
  - Handle offer/answer exchange
  - Manage connection state for same-device communication

## Example Export Payload

```json
{
  "id": "/+123456/posters/789",
  "type": "poster",
  "microdata": "<svg ... itemid='/+123456/posters/789' ...>...</svg>",
  "svg": "<svg ...>...</svg>",
  "metadata": {
    "exif": { "location": "..." },
    "created": 1234567890
  }
}
```

## Next Steps

- **Step 2:** Implement WebRTC signaling protocol
- **Step 3:** Create data channel for MCP message transport
- **Step 4:** Implement MCP server functionality in Realness
- **Step 5:** Define MCP tools for exporting Thoughts
