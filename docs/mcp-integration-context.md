# MCP Integration Context for Realness

## Overview

- **Goal:** Make Realness's Thoughts available to LLM's via MCP (Model Context Protocal).

- **Motivation:** Share Thoughts with LLMs so AI can export posters in multiple formats for Blender, Illustrator, Procreate, etc.

## Data Model

- **Thoughts:** the feed view — 13 minute windows of statements (atomic text), posters, and events.
- **Structure:**
  - `microdata` (HTML/DOM structure, itemid, itemtype, itemprop)
- **Source:**
  - <a href="src/components/as-days.vue">as-days.vue</a> and as_thoughts utility provide the iterable, normalized structure for Thoughts.
  - <a href="src/utils/item.js">item.js</a> and <a href="src/utils/itemid.js">itemid.js</a> handle extraction, validation, and microdata parsing.

## Current Implementation (Local Filesystem)

### MCP Server with Local Filesystem Access

- **Server:** `scripts/server.js` provides both HTTP API and MCP server functionality
- **Storage:** Files stored in `storage/people/` directory HTML files
- **MCP Tools Available:**
  - `get_thoughts_html` - Get HTML for Thoughts view with all thoughts from all users
  - `get_thought` - Get complete Thought with metadata
  - `list_thoughts` - List all Thoughts for a person
  - `export_thought` - Export Thought in canonical JSON format
  - `read_item` - Load item by ID
  - `write_item` - Save item with HTML content
  - `list_items` - List items in directory
  - `delete_item` - Remove item

### Development Workflow

1. **Start Server:** `npm run server:start` - runs both HTTP API and MCP server
2. **Sync Data:** `npm run server:sync` - sync with Firebase
3. **Use MCP Tools:** Connect MCP client to access Thoughts programmatically

## Future: WebRTC PWA Integration

- **Purpose:** Enable non-technical users to share Thoughts outside the local filesystem
- **Architecture:** WebRTC peer-to-peer communication between Realness PWA and local applications
- **Benefits:** Elegant solution for sharing Thoughts without requiring technical setup

### Planned Components

- **Connection Dialog:** `as-dialog-connection.vue` for establishing P2P connections
- **Export UI:** Button/menu to trigger Thought export from PWA
- **Real-time Sync:** Live data exchange between web app and local tools

### Implementation Status

- **Step 1:** WebRTC Peer Connection Setup (planned)
- **Step 2:** Signaling Protocol (planned)
- **Step 3:** Data Channel for MCP Transport (planned)
- **Step 4:** PWA Integration (planned)

## Current Status

✅ **Local filesystem MCP integration is complete and functional**
🔄 **WebRTC PWA integration is planned for future development**
