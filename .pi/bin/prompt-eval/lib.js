import { mkdirSync as mkdir_sync, readFileSync as read_file_sync, writeFileSync as write_file_sync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

export const here = dirname(file_url_to_path(import.meta.url))
export const root = join(here, '../../..')
export const pi = join(root, '.pi/bin/pi')

/**
 * @param {string} text
 * @param {string} heading
 */
export const drop_section = (text, heading) => {
  const lines = text.split('\n')
  const start = lines.findIndex(line => line === `## ${heading}`)
  if (start < 0) throw new Error(`no section: ${heading}`)
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  return [...lines.slice(0, start), ...(end < 0 ? [] : lines.slice(end))].join('\n')
}

/**
 * @param {string} text
 * @param {string} heading
 */
export const drop_intro = (text, heading) => {
  const lines = text.split('\n')
  const start = lines.findIndex(line => line === `## ${heading}`)
  if (start < 0) throw new Error(`no section: ${heading}`)
  const end = lines.findIndex((line, i) => i > start && line.startsWith('- '))
  return [...lines.slice(0, start + 1), '', ...lines.slice(end)].join('\n')
}

/**
 * @param {string} text
 * @param {string} start_text
 */
export const drop_rule = (text, start_text) => {
  const lines = text.split('\n')
  const start = lines.findIndex(line => line.startsWith(`- ${start_text}`))
  if (start < 0) throw new Error(`no rule: ${start_text}`)
  let end = start + 1
  while (lines[end]?.startsWith('  ')) end++
  return [...lines.slice(0, start), ...lines.slice(end)].join('\n')
}

/**
 * The prompt under test. With `learnings`, the root AGENTS.md joins it, because runs from `/` do not load it.
 * @param {boolean} learnings
 */
export const base_prompt = learnings => {
  const append = read_file_sync(join(root, '.pi/agent/APPEND_SYSTEM.md'), 'utf8')
  return learnings ? `${append}\n\n${read_file_sync(join(root, 'AGENTS.md'), 'utf8')}` : append
}

/**
 * `section:Name`, `intro:Name`, `rule:Start of line`, or `file:path` for a whole replacement prompt.
 * @param {string[]} specs
 * @param {string} full
 * @returns {{ name: string, text: string }[]}
 */
export const variants_from = (specs, full) => [
  { name: 'full', text: full },
  { name: 'none', text: '' },
  ...specs.map(spec => {
    const [kind, ...rest] = spec.split(':')
    const value = rest.join(':')
    if (kind === 'file') return { name: basename(value, '.md'), text: read_file_sync(join(root, value), 'utf8') }
    const drop = { section: drop_section, intro: drop_intro, rule: drop_rule }[kind]
    if (!drop) throw new Error(`unknown variant: ${spec}`)
    return { name: `minus-${kind}-${value.replace(/\W+/g, '-')}`, text: drop(full, value) }
  })
]

/** @param {string} kind */
export const make_out_dir = kind => {
  const dir = join(root, 'artifacts/prompt-eval', kind, new Date().toISOString().replace(/[:.]/g, '-'))
  mkdir_sync(dir, { recursive: true })
  return dir
}

/**
 * @param {string} dir
 * @param {{ name: string, text: string }[]} variants
 */
export const write_variants = (dir, variants) => {
  for (const v of variants) write_file_sync(join(dir, `${v.name}.md`), v.text)
}

/**
 * @template T
 * @param {(() => Promise<T>)[]} jobs
 * @param {number} limit
 */
export const pool = async (jobs, limit) => {
  /** @type {T[]} */
  const results = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++
      results[i] = await jobs[i]()
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

/**
 * @param {Record<string, any>[]} rows
 * @param {string[]} names
 * @param {string[]} metrics
 */
export const averages = (rows, names, metrics) =>
  names.map(name => {
    const mine = rows.filter(r => r.variant === name)
    return {
      variant: name,
      ...Object.fromEntries(metrics.map(m => [m, +(mine.reduce((s, r) => s + r[m], 0) / mine.length).toFixed(1)]))
    }
  })
