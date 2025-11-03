#!/usr/bin/env node

import { createServer } from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { readFile, stat, readdir } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { load_item, upload, remove, directory } from '../src/utils/host.js'
import {
  is_itemid,
  as_type,
  as_author,
  as_created_at
} from '../src/utils/itemid.js'
import { get_item } from '../src/utils/item.js'

const PORT = process.env.LOCAL_SERVER_PORT || 3000
const STORAGE_PATH = process.env.STORAGE_PATH || './storage'

// Helper function to generate Thoughts HTML
const generate_thoughts_html = async () => {
  const all_thoughts = []

  try {
    // Get all people directories
    const people_path = join(STORAGE_PATH, 'people')
    const people_dirs = await readdir(people_path, { withFileTypes: true })

    for (const person_dir of people_dirs) {
      if (!person_dir.isDirectory()) continue

      const author_id = `/${person_dir.name}`

      // Get posters for this person
      try {
        const posters_dir = await directory(`${author_id}/posters/`)
        if (posters_dir && posters_dir.items) 
          for (const poster_id of posters_dir.items) {
            const full_id = `${author_id}/posters/${poster_id}`
            const item = await load_item(full_id)
            if (item) 
              all_thoughts.push({
                id: full_id,
                type: 'poster',
                author: author_id,
                created_at: as_created_at(full_id),
                content: item
              })
            
          }
        
      } catch (error) {
        // Directory might not exist
      }

      // Get statements for this person
      try {
        const statements_dir = await directory(`${author_id}/statements/`)
        if (statements_dir && statements_dir.items) 
          for (const statement_id of statements_dir.items) {
            const full_id = `${author_id}/statements/${statement_id}`
            const item = await load_item(full_id)
            if (item) 
              all_thoughts.push({
                id: full_id,
                type: 'statement',
                author: author_id,
                created_at: as_created_at(full_id),
                content: item
              })
            
          }
        
      } catch (error) {
        // Directory might not exist
      }
    }

    // Sort by creation date (newest first)
    all_thoughts.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))

    // Generate HTML similar to the Thoughts.vue template
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thoughts - Realness</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
        .thought { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .thought-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .thought-type { background: #007bff; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .thought-author { color: #666; font-size: 14px; }
        .thought-date { color: #999; font-size: 12px; }
        .thought-content { margin-top: 10px; }
        svg { max-width: 100%; height: auto; }
        h1 { color: #007bff; margin-bottom: 30px; }
    </style>
</head>
<body>
    <h1>Thoughts</h1>
    <div class="thoughts-container">
`

    for (const thought of all_thoughts) {
      const date = thought.created_at
        ? new Date(thought.created_at * 1000).toLocaleDateString()
        : 'Unknown date'

      html += `
        <div class="thought">
            <div class="thought-header">
                <span class="thought-type">${thought.type}</span>
                <div>
                    <span class="thought-author">${thought.author}</span>
                    <span class="thought-date">${date}</span>
                </div>
            </div>
            <div class="thought-content">
                ${thought.content.outerHTML || thought.content.innerHTML || JSON.stringify(thought.content, null, 2)}
            </div>
        </div>
      `
    }

    html += `
    </div>
</body>
</html>
`

    return html
  } catch (error) {
    return `<html><body><h1>Error loading thoughts</h1><p>${error.message}</p></body></html>`
  }
}

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
        if (!file_path.endsWith('.html.gz'))
          if (file_path.endsWith('/'))
            file_path = `${file_path.slice(0, -1)}.html.gz`
          else file_path += '.html.gz'

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
  },
  {
    name: 'get_thought',
    description: 'Get a complete Thought (poster or statement) with metadata',
    inputSchema: {
      type: 'object',
      properties: {
        itemid: {
          type: 'string',
          description: 'The item ID to load as a Thought'
        }
      },
      required: ['itemid']
    }
  },
  {
    name: 'list_thoughts',
    description: 'List all Thoughts (posters and statements) for a person',
    inputSchema: {
      type: 'object',
      properties: {
        author_id: {
          type: 'string',
          description: 'The author ID (e.g., /+123456)'
        }
      },
      required: ['author_id']
    }
  },
  {
    name: 'export_thought',
    description: 'Export a Thought in canonical JSON format for external tools',
    inputSchema: {
      type: 'object',
      properties: {
        itemid: {
          type: 'string',
          description: 'The item ID to export'
        }
      },
      required: ['itemid']
    }
  },
  {
    name: 'get_thoughts_html',
    description:
      'Get the HTML for the Thoughts view with all thoughts from all users',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
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

      case 'get_thought': {
        const { itemid } = args
        if (!is_itemid(itemid)) throw new Error('Invalid itemid format')
        const item = await load_item(itemid)
        if (!item) throw new Error('Thought not found')

        const thought = {
          id: item.id,
          type: as_type(item.id),
          author: as_author(item.id),
          created_at: as_created_at(item.id),
          content: item,
          microdata: item // The item itself contains the microdata structure
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(thought, null, 2)
            }
          ]
        }
      }

      case 'list_thoughts': {
        const { author_id } = args
        if (!author_id.startsWith('/+'))
          throw new Error('Invalid author ID format')

        const thoughts = []

        // Get posters
        try {
          const posters_dir = await directory(`${author_id}/posters/`)
          if (posters_dir && posters_dir.items) 
            for (const poster_id of posters_dir.items) {
              const full_id = `${author_id}/posters/${poster_id}`
              const item = await load_item(full_id)
              if (item) 
                thoughts.push({
                  id: full_id,
                  type: 'poster',
                  author: author_id,
                  created_at: as_created_at(full_id),
                  content: item
                })
              
            }
          
        } catch (error) {
          // Directory might not exist
        }

        // Get statements
        try {
          const statements_dir = await directory(`${author_id}/statements/`)
          if (statements_dir && statements_dir.items) 
            for (const statement_id of statements_dir.items) {
              const full_id = `${author_id}/statements/${statement_id}`
              const item = await load_item(full_id)
              if (item) 
                thoughts.push({
                  id: full_id,
                  type: 'statement',
                  author: author_id,
                  created_at: as_created_at(full_id),
                  content: item
                })
              
            }
          
        } catch (error) {
          // Directory might not exist
        }

        // Sort by creation date (newest first)
        thoughts.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(thoughts, null, 2)
            }
          ]
        }
      }

      case 'export_thought': {
        const { itemid } = args
        if (!is_itemid(itemid)) throw new Error('Invalid itemid format')
        const item = await load_item(itemid)
        if (!item) throw new Error('Thought not found')

        // Create canonical export format as described in MCP integration context
        const export_data = {
          id: item.id,
          type: as_type(item.id),
          microdata: item, // The item itself contains the microdata structure
          content: item, // For posters this would be SVG, for statements this would be text
          metadata: {
            author: as_author(item.id),
            created: as_created_at(item.id),
            // Add any additional metadata that might be useful for external tools
            exported_at: new Date().toISOString()
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(export_data, null, 2)
            }
          ]
        }
      }

      case 'get_thoughts_html': {
        const html = await generate_thoughts_html()
        return {
          content: [
            {
              type: 'text',
              text: html
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
