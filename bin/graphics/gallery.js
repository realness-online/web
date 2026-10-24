#!/usr/bin/env node

import { execFileSync as exec_file_sync, spawn } from 'node:child_process'
import {
  copyFileSync as copy_file_sync,
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { product_import } from '../lib/product.js'

const { export_static } = await product_import('publish/view')

const ROOT = resolve(dirname(file_url_to_path(import.meta.url)), '../..')
const SITE = join(ROOT, 'artifacts/gallery-site')
const PORT = process.env.GALLERY_PORT || '3200'
const MARK = '/* gallery: masonry */'

const GALLERY_CSS = `
${MARK}
main > section:has(> article) {
  --gutter: 2px;
  columns: 28rem;
  column-gap: var(--gutter);
  padding: 0;
}
main > section > article {
  break-inside: avoid;
  border-bottom: 0;
  margin-bottom: var(--gutter);
}
main > section > article figure {
  height: auto;
}
main > section > article figure img {
  width: 100%;
  height: auto;
  object-fit: contain;
}
/* the index is all art: the title stays for screen readers, and a click
   opens the poster's page, where the text is */
main > section > article summary figcaption {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
`

const GALLERY_JS = `for (const summary of document.querySelectorAll('main > section > article summary')) {
  const link = summary.querySelector('a[itemprop="url"]')
  if (link)
    summary.addEventListener('click', event => {
      event.preventDefault()
      location.href = link.href
    })
}
`

const KB = 1024
const run = (command, args, cwd = SITE) =>
  exec_file_sync(command, args, { cwd, stdio: 'inherit' })

const fail = message => {
  console.error(`gallery: ${message}`)
  process.exit(1)
}

/** A url-safe name for a source path: `a/Big Photo.JPG` -> `a-big-photo-jpg`. */
const slug_of = source =>
  source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const yaml_string = value => JSON.stringify(String(value))

const setup = async () => {
  if (!exists_sync(join(SITE, 'package.json'))) {
    rm_sync(SITE, { recursive: true, force: true })
    await export_static(SITE)
  }
  if (!exists_sync(join(SITE, 'node_modules')))
    run('npm', ['install', '--no-fund', '--no-audit'])
  const style = join(SITE, 'static/style.css')
  const css = read_file_sync(style, 'utf8')
  const at = css.indexOf(MARK)
  write_file_sync(style, `${(at < 0 ? css : css.slice(0, at)).trimEnd()}\n${GALLERY_CSS}`)
  write_file_sync(join(SITE, 'static/scripts/gallery.js'), GALLERY_JS)
}

const load = posters_dir => {
  const records_file = join(posters_dir, 'posters.json')
  if (!exists_sync(records_file))
    fail(`no posters.json in ${posters_dir} - run npm run make:posters first`)
  return JSON.parse(read_file_sync(records_file, 'utf8')).filter(record => record.poster)
}

const write_content = (posters_dir, records) => {
  const articles = join(SITE, 'content/articles')
  const posters = join(SITE, 'static/posters')
  rm_sync(articles, { recursive: true, force: true })
  rm_sync(posters, { recursive: true, force: true })
  mkdir_sync(articles, { recursive: true })
  mkdir_sync(posters, { recursive: true })
  for (const record of records) {
    const slug = slug_of(record.source)
    copy_file_sync(join(posters_dir, record.poster), join(posters, `${slug}.svg`))
    const title = basename(record.source).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
    write_file_sync(
      join(articles, `${slug}.md`),
      `---
title: ${yaml_string(title)}
img: ${slug}.svg
description: ${yaml_string(record.source)}
---

${record.source} · ${Math.round(record.bytes / KB)} KB original · ${Math.round(record.gzip_bytes / KB)} KB poster gzipped · \`${record.sha256.slice(0, 12)}\`
`
    )
  }
  return records.length ? `${slug_of(records[0].source)}.svg` : undefined
}

const write_site = (name, cover) => {
  const site_json = join(SITE, 'site.json')
  const site = JSON.parse(read_file_sync(site_json, 'utf8'))
  write_file_sync(
    site_json,
    `${JSON.stringify(
      {
        ...site,
        name,
        tagline: 'Posters from iCloud',
        url: `http://localhost:${PORT}`,
        poster: cover ?? site.poster,
        head: '<script type="module" src="/scripts/gallery.js"></script>'
      },
      null,
      2
    )}\n`
  )
  const header = join(SITE, 'partials/header.html')
  write_file_sync(
    header,
    read_file_sync(header, 'utf8')
      .replace('Your Name', name)
      .replace('What you do', 'Posters from iCloud')
  )
}

const [, , folder] = process.argv
if (!folder || folder.startsWith('--'))
  fail('usage: npm run gallery <artifacts/posters/folder> [--build]')
const posters_dir = resolve(folder)
if (!exists_sync(posters_dir)) fail(`not found: ${posters_dir}`)

const records = load(posters_dir)
await setup()
write_site(basename(posters_dir), write_content(posters_dir, records))
console.info(`gallery: ${records.length} posters from ${posters_dir}`)

if (process.argv.includes('--build')) run(process.execPath, ['build.js', '--drafts'])
else {
  const server = spawn(process.execPath, ['serve.js'], {
    cwd: SITE,
    stdio: 'inherit',
    env: { ...process.env, PORT }
  })
  server.on('exit', code => process.exit(code ?? 0))
}
