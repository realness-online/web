#!/usr/bin/env node
import { mkdir, readFile as read_file, writeFile as write_file } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { collect_commands } from './commands/catalog.js'

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const order = ['Monitor', 'Run locally', 'Build', 'Test', 'Check', 'Sign-in and files', 'Hosts and services', 'Deploy and release', 'Tools', 'Actor commands', 'Internal helpers']

/** Regenerate the shared commands page and its machine-readable audit from source. */
export const update_commands = async (root, { page = join(root, 'artifacts/commands/index.html') } = {}) => {
  const catalog = await collect_commands(root)
  const template = await read_file(join(root, 'bin/harness/commands/page.html'), 'utf8')
  const id = template.match(/itemid="([^"]+)"/)?.[1]
  if (!id) throw new Error('Commands page must retain its itemid')
  const groups = order.map(name => [name, catalog.entries.filter(entry => entry.group === name)])
  const card = entry => `<li><header><h3>${escape(entry.title.replaceAll(':', ' / '))}</h3><span>${escape(entry.kind)} - ${escape(entry.package)}</span></header><p><strong>${escape(entry.review)}</strong> - ${escape(entry.review_reason)}</p><p><code>${escape(entry.display)}</code><button type="button" value="${escape(entry.command)}" aria-label="Copy ${escape(entry.display)}">Copy</button></p><details><summary>Source and details</summary><p>${escape(entry.definition)}</p><p>${escape(entry.options)}</p><p>${escape(entry.context)}</p><p>Source: <code>${escape(entry.source)}</code></p></details></li>`
  const values = {
    itemid: escape(id),
    count: catalog.entries.length,
    navigation: '<button type="button" value="all" aria-pressed="true" aria-controls="command-list">All</button>\n' + groups.map(([name]) => `<button type="button" value="${escape(name)}" aria-pressed="false" aria-controls="command-list">${escape(name)}</button>`).join('\n'),
    commands: groups.map(([name, entries], index) => `<section id="group-${index}"><h2>${escape(name)}</h2>${name === 'Deploy and release' ? '<p>These commands can change remote services or publish releases.</p>' : ''}<ul>${entries.map(card).join('\n')}</ul></section>`).join('\n'),
    scope: escape(catalog.scope),
    warnings: `<ul>${catalog.warnings.map(warning => `<li><code>${escape(warning.source)}</code><p>${escape(warning.message)}</p></li>`).join('')}</ul>`,
    bins: `<ul>${catalog.bins.map(bin => `<li><code>${escape(bin.name)}</code><p>${escape(bin.entry)}</p></li>`).join('')}</ul><h2>Shell libraries</h2><ul>${catalog.shell_libraries.map(path => `<li><code>${escape(path)}</code><p>Sourced by other scripts; not a standalone command.</p></li>`).join('')}</ul>`,
  }
  await mkdir(resolve(page, '..'), { recursive: true })
  await write_file(join(resolve(page, '..'), 'commands.js'), await read_file(join(root, 'bin/harness/commands/page.js')))
  await write_file(page, template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]))
  const artifacts = join(root, 'artifacts/commands')
  await mkdir(artifacts, { recursive: true })
  await write_file(join(artifacts, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
  return catalog
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const catalog = await update_commands(resolve(import.meta.dirname, '../..'))
  console.log(`${catalog.entries.length} entries from ${catalog.packages.length} packages; ${catalog.shell_libraries.length} shell libraries`)
}
