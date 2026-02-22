# Local Filesystem Server Setup

This document describes how to set up and use the local filesystem server for offline-first development.

## Quick Start

1. **Copy environment template:**

   ```bash
   cp .env.local.template .env.local
   ```

2. **Edit `.env.local` with your configuration:**

   - Set `LOCAL_SERVER_PORT` (default: 3000)
   - Set `STORAGE_PATH` (default: ./storage)
   - Set `OBSIDIAN_VAULT_PATH` to your vault location

3. **Start the local server:**

   ```bash
   npm run server:start
   ```

4. **Sync with Firebase (optional):**

   ```bash
   npm run server:sync
   ```

5. **MCP tools are integrated** - The MCP server runs automatically with the HTTP server

## Architecture

The local server provides the same API as `serverless.js` but uses the filesystem instead of Firebase:

- **Storage**: Files stored in `storage/people/` directory structure
- **Format**: Gzipped HTML files with microdata preserved
- **API**: HTTP server on localhost with CORS enabled
- **Sync**: Bi-directional sync with Firebase via service account

## API Endpoints

- `GET /api/{itemid}` - Load item by ID
- `GET /directory/{directory_id}` - List directory contents
- `GET /` - Serve static files from storage

## MCP Tools

The MCP server provides tools for both Realness items and Obsidian notes:

### Realness Tools

- `read_item` - Load item by ID
- `write_item` - Save item with HTML content
- `list_items` - List items in directory
- `delete_item` - Remove item

### Obsidian Tools

_Note: Obsidian tools are not yet implemented in the current version_

## File Structure

```
storage/
├── people/
│   └── +123456/
│       ├── posters/
│       │   ├── 123456.html.gz
│       │   └── 789012.html.gz
│       └── thoughts/
│           └── 345678.html.gz
└── .sync-state.json
```

## Development Workflow

1. **Local Development**: Use `npm run server:start` for offline development
2. **Sync Changes**: Run `npm run server:sync` to sync with Firebase
3. **Tool Integration**: Use MCP tools to interact with both Realness and Obsidian data
4. **Deploy**: Use existing Firebase deployment process

## Troubleshooting

- **Port conflicts**: Change `LOCAL_SERVER_PORT` in `.env.local`
- **Storage issues**: Check `STORAGE_PATH` permissions
- **Sync failures**: Verify Firebase service account configuration
- **MCP connection**: Ensure MCP client is configured correctly
