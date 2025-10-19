#!/usr/bin/env node

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
import { location, load_html, load_item, directory } from './host-server.js'

const gzip_async = promisify(gzip)

const PORT = process.env.LOCAL_SERVER_PORT || 3000
const STORAGE_PATH = process.env.STORAGE_PATH || './storage'

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

const handle_request = async (req, res) => {
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

      if (req.method === 'GET') {
        const html = await load_html(itemid)
        if (!html) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not found')
          return
        }

        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600'
        })
        res.end(html)
        return
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

    // Handle root path
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

const server = createServer(handle_request)

server.listen(PORT, () => {
  console.log(`Local filesystem server running on http://localhost:${PORT}`)
  console.log(`Storage path: ${STORAGE_PATH}`)
  console.log('Press Ctrl+C to stop')
})

// Graceful shutdown
const gracefulShutdown = signal => {
  console.log(`\nReceived ${signal}. Shutting down server...`)

  const timeout = setTimeout(() => {
    console.log('Forceful shutdown after timeout')
    process.exit(1)
  }, 5000)

  server.close(() => {
    clearTimeout(timeout)
    console.log('Server stopped')
    process.exit(0)
  })
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
