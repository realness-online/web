#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import {
  load_item,
  load_html,
  upload,
  remove,
  directory,
  location
} from '../src/utils/host.js'
import { as_path_parts, as_type, is_itemid } from '../src/utils/itemid.js'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const OBSIDIAN_VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH ||
  '/Users/scott/Library/Mobile Documents/iCloud~md~obsidian/Documents/Anotht'

const server = new Server(
  {
    name: 'realness-local-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

// Realness item tools
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
        itemid: {
          type: 'string',
          description: 'The item ID to save'
        },
        html: {
          type: 'string',
          description: 'The HTML content with microdata'
        }
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
        itemid: {
          type: 'string',
          description: 'The item ID to delete'
        }
      },
      required: ['itemid']
    }
  }
]

// Obsidian tools
const obsidian_tools = [
  {
    name: 'read_note',
    description: 'Read a markdown note from Obsidian vault',
    inputSchema: {
      type: 'object',
      properties: {
        note_path: {
          type: 'string',
          description:
            'Path to the note relative to vault root (e.g., "01 Projects/My Project.md")'
        }
      },
      required: ['note_path']
    }
  },
  {
    name: 'search_notes',
    description: 'Search across all notes in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        directory: {
          type: 'string',
          description:
            'Optional directory to search within (e.g., "01 Projects")'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_notes',
    description: 'List notes in a vault directory',
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description:
            'Directory to list (e.g., "01 Projects", "02 Areas", "03 Resources")'
        }
      },
      required: ['directory']
    }
  },
  {
    name: 'query_graph',
    description: 'Find notes connected via wikilinks',
    inputSchema: {
      type: 'object',
      properties: {
        note_name: {
          type: 'string',
          description: 'Name of the note to find connections for'
        }
      },
      required: ['note_name']
    }
  }
]

const all_tools = [...realness_tools, ...obsidian_tools]

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: all_tools
}))

server.setRequestHandler(CallToolRequestSchema, async request => {
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

      case 'read_note': {
        const { note_path } = args
        const full_path = join(OBSIDIAN_VAULT_PATH, note_path)
        try {
          const content = await readFile(full_path, 'utf-8')
          return {
            content: [
              {
                type: 'text',
                text: content
              }
            ]
          }
        } catch (error) {
          if (error.code === 'ENOENT')
            return {
              content: [
                {
                  type: 'text',
                  text: 'Note not found'
                }
              ]
            }

          throw error
        }
      }

      case 'search_notes': {
        const { query, directory: search_dir } = args
        const search_path = search_dir
          ? join(OBSIDIAN_VAULT_PATH, search_dir)
          : OBSIDIAN_VAULT_PATH

        const results = []
        const search_directory = async (dir_path, relative_path = '') => {
          const entries = await readdir(dir_path, { withFileTypes: true })

          for (const entry of entries) {
            const full_path = join(dir_path, entry.name)
            const note_path = join(relative_path, entry.name)

            if (entry.isDirectory() && !entry.name.startsWith('.'))
              await search_directory(full_path, note_path)
            else if (entry.name.endsWith('.md'))
              try {
                const content = await readFile(full_path, 'utf-8')
                if (content.toLowerCase().includes(query.toLowerCase()))
                  results.push({
                    path: note_path,
                    content: `${content.substring(0, 200)}...`
                  })
              } catch (error) {
                // Skip files that can't be read
              }
          }
        }

        await search_directory(search_path)

        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} notes matching "${query}":\n\n${results
                .map(r => `- ${r.path}\n  ${r.content}`)
                .join('\n\n')}`
            }
          ]
        }
      }

      case 'list_notes': {
        const { directory: dir_name } = args
        const dir_path = join(OBSIDIAN_VAULT_PATH, dir_name)

        try {
          const entries = await readdir(dir_path, { withFileTypes: true })
          const notes = entries
            .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
            .map(entry => entry.name)

          return {
            content: [
              {
                type: 'text',
                text: `Notes in ${dir_name}:\n${notes.map(n => `- ${n}`).join('\n')}`
              }
            ]
          }
        } catch (error) {
          if (error.code === 'ENOENT')
            return {
              content: [
                {
                  type: 'text',
                  text: `Directory ${dir_name} not found`
                }
              ]
            }

          throw error
        }
      }

      case 'query_graph': {
        const { note_name } = args
        const note_path = join(OBSIDIAN_VAULT_PATH, note_name)

        try {
          const content = await readFile(note_path, 'utf-8')

          // Find wikilinks [[note name]] and backlinks
          const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || []
          const linked_notes = wikilinks.map(link => link.slice(2, -2))

          // Find backlinks (notes that link to this note)
          const backlinks = []
          const search_directory = async dir_path => {
            const entries = await readdir(dir_path, { withFileTypes: true })

            for (const entry of entries) {
              const full_path = join(dir_path, entry.name)

              if (entry.isDirectory() && !entry.name.startsWith('.'))
                await search_directory(full_path)
              else if (entry.name.endsWith('.md'))
                try {
                  const file_content = await readFile(full_path, 'utf-8')
                  if (file_content.includes(`[[${note_name}]]`))
                    backlinks.push(entry.name)
                } catch (error) {
                  // Skip files that can't be read
                }
            }
          }

          await search_directory(OBSIDIAN_VAULT_PATH)

          return {
            content: [
              {
                type: 'text',
                text:
                  `Graph for ${note_name}:\n\n` +
                  `Outgoing links:\n${linked_notes.map(n => `- ${n}`).join('\n')}\n\n` +
                  `Backlinks:\n${backlinks.map(n => `- ${n}`).join('\n')}`
              }
            ]
          }
        } catch (error) {
          if (error.code === 'ENOENT')
            return {
              content: [
                {
                  type: 'text',
                  text: 'Note not found'
                }
              ]
            }

          throw error
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Realness MCP server running on stdio')
}

main().catch(console.error)
