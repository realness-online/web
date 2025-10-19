#!/usr/bin/env node

import { createServer } from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { load_item, upload, remove, directory } from '../src/utils/host.js'
import { is_itemid } from '../src/utils/itemid.js'

const PORT = process.env.LOCAL_SERVER_PORT || 3000
const STORAGE_PATH = process.env.STORAGE_PATH || './storage'

// HTTP Server functionality
const get_content_type = path => {
  const ext = extname(path)
  switch (ext) {
    case '.html':
    case '.htm':
      return 'text/html'
    case '.css':
      return 'text/css'
    case '.js':
      return 'application/javascript'
    case '.json':
      return 'application/json'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.woff2':
      return 'font/woff2'
    case '.woff':
      return 'font/woff'
    case '.ttf':
      return 'font/ttf'
    default:
      return 'application/octet-stream'
  }
}

const set_cors_headers = res => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  )
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

const handle_http_request = async (req, res) => {
  set_cors_headers(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const { pathname } = url

  console.log(`${req.method} ${pathname}`)

  try {
    // API endpoints
    if (pathname.startsWith('/api/')) {
      const itemid = pathname.replace('/api/', '')
      console.log(`API request for itemid: ${itemid}`)

      if (req.method === 'GET') {
        // Serve static files directly instead of using client-side persistence
        let file_path = join(STORAGE_PATH, 'compressed', itemid)

        // Add .html.gz extension
        if (!file_path.endsWith('.html.gz')) {
          if (file_path.endsWith('/')) {
            file_path = file_path.slice(0, -1) + '.html.gz'
          } else {
            file_path += '.html.gz'
          }
        }

        console.log(`Looking for file: ${file_path}`)

        try {
          const compressed_data = await readFile(file_path)
          const { inflate } = await import('node:zlib')
          const { promisify } = await import('node:util')
          const inflate_async = promisify(inflate)
          const html_data = await inflate_async(compressed_data)

          res.writeHead(200, {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600'
          })
          res.end(html_data)
          return
        } catch (error) {
          if (error.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('Not found')
            return
          }
          throw error
        }
      }
    }

    // Directory listing
    if (pathname.startsWith('/directory/')) {
      const itemid = `${pathname.replace('/directory/', '')}/`
      const dir = await directory(itemid)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(dir))
      return
    }

    // Static file serving
    let file_path = join(STORAGE_PATH, pathname)
    if (pathname === '/') file_path = join(STORAGE_PATH, 'index.html')

    try {
      const stats = await stat(file_path)
      if (stats.isDirectory()) file_path = join(file_path, 'index.html')

      const content = await readFile(file_path)
      const content_type = get_content_type(file_path)

      res.writeHead(200, {
        'Content-Type': content_type,
        'Content-Length': content.length,
        'Cache-Control': 'public, max-age=3600'
      })
      res.end(content)
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
      } else throw error
    }
  } catch (error) {
    console.error('Request error:', error)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal server error')
  }
}

// MCP Server functionality
const realness_tools = [
  {
    name: 'read_item',
    description: 'Load an item by ID from the local filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        itemid: {
          type: 'string',
          description: 'The item ID to load (e.g., /+123456/posters/789)'
        }
      },
      required: ['itemid']
    }
  },
  {
    name: 'write_item',
    description: 'Save an item to the local filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        itemid: { type: 'string', description: 'The item ID to save' },
        html: { type: 'string', description: 'The HTML content with microdata' }
      },
      required: ['itemid', 'html']
    }
  },
  {
    name: 'list_items',
    description: 'List items in a directory',
    inputSchema: {
      type: 'object',
      properties: {
        directory_id: {
          type: 'string',
          description: 'The directory ID to list (e.g., /+123456/posters/)'
        }
      },
      required: ['directory_id']
    }
  },
  {
    name: 'delete_item',
    description: 'Remove an item from the local filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        itemid: { type: 'string', description: 'The item ID to delete' }
      },
      required: ['itemid']
    }
  }
]

const mcp_server = new Server(
  { name: 'realness-unified-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

mcp_server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: realness_tools
}))

mcp_server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'read_item': {
        const { itemid } = args
        if (!is_itemid(itemid)) throw new Error('Invalid itemid format')
        const item = await load_item(itemid)
        return {
          content: [
            {
              type: 'text',
              text: item ? JSON.stringify(item, null, 2) : 'Item not found'
            }
          ]
        }
      }

      case 'write_item': {
        const { itemid, html } = args
        if (!is_itemid(itemid)) throw new Error('Invalid itemid format')
        await upload(itemid, html)
        return {
          content: [
            {
              type: 'text',
              text: `Item ${itemid} saved successfully`
            }
          ]
        }
      }

      case 'list_items': {
        const { directory_id } = args
        const dir = await directory(directory_id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dir, null, 2)
            }
          ]
        }
      }

      case 'delete_item': {
        const { itemid } = args
        if (!is_itemid(itemid)) throw new Error('Invalid itemid format')
        await remove(itemid)
        return {
          content: [
            {
              type: 'text',
              text: `Item ${itemid} deleted successfully`
            }
          ]
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    }
  }
})

// Main function
async function main() {
  // Start HTTP server
  const http_server = createServer(handle_http_request)

  http_server.listen(PORT, () => {
    console.log(`HTTP server running on http://localhost:${PORT}`)
    console.log(`Storage path: ${STORAGE_PATH}`)
    console.log('Press Ctrl+C to stop')
  })

  // Start MCP server
  const transport = new StdioServerTransport()
  await mcp_server.connect(transport)
  console.error('MCP server running on stdio')

  // Graceful shutdown
  const gracefulShutdown = signal => {
    console.log(`\nReceived ${signal}. Shutting down server...`)
    const timeout = setTimeout(() => {
      console.log('Forceful shutdown after timeout')
      process.exit(1)
    }, 5000)

    http_server.close(() => {
      clearTimeout(timeout)
      console.log('Server stopped')
      process.exit(0)
    })
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
}

main().catch(console.error)
