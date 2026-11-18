#!/usr/bin/env node
/**
 * Print the brief a scout would run, or run every source of it at once.
 *
 *     node scripts/scout.js
 *     node scripts/scout.js realness --source vuejobs
 *     node scripts/scout.js Archive/Projects/realness-leads --run
 *
 * `--run` starts one pi per source, all together, on this Mac. A source that
 * fails writes its reason and leaves the others running.
 */
import { spawn } from 'node:child_process'
import {
  createWriteStream as create_write_stream,
  writeFileSync as write_file_sync
} from 'node:fs'
import { item_html } from '#root/lib/items.js'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { ISO_DATE, MS_PER_SECOND } from '#root/lib/units.js'
import { run_scout } from '../src/scouts/run.js'
import { STAGES_PAGE } from '../src/scouts/stages.js'
import { gzipSync as gzip_sync } from 'node:zlib'
import { find_scout, scout_pages } from '../src/scouts/scout.js'
import {
  hops_inside,
  reads_inside,
  source_sections
} from '../src/scouts/sources.js'

export { reads_inside }
import { box_ready } from '../src/scouts/preflight.js'
import { source_refused } from '../src/scouts/source.js'
import { model_watch } from '../src/scouts/model-watch.js'
import { person } from '../src/harness/settings.js'
import { readFileSync as read_file_sync } from 'node:fs'
import { appendFileSync as append_file_sync } from 'node:fs'
import { run_entry } from './lib/entry.js'

/** The harness root: this checkout's, or the box's `/realness` when given. */
const here =
  process.env.REALNESS_HOME ??
  resolve(dirname(file_url_to_path(import.meta.url)), '../../..')
const vault_dir = resolve(here, 'vault')

/** The value after a flag, or empty. */
const value_of = (args, flag) => {
  const at = args.indexOf(flag)
  return at === -1 ? '' : (args[at + 1] ?? '')
}

/** The one source a run reads, from `--source <key>`. */
const source_of = args => value_of(args, '--source')

/**
 * One finished pi step as a short line: the tool, what it ran, what came back.
 * @param {Record<string, any>} start the matching tool_execution_start
 * @param {Record<string, any>} end the tool_execution_end
 */
export const step_of = (start, end) => {
  const args = start?.args ?? end?.args ?? {}
  const did = String(args.command ?? args.path ?? JSON.stringify(args))
    .replace(/\s+/g, ' ')
    .slice(0, SHOWN)
  const text = (end?.result?.content ?? [])
    .map(part => part.text ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
  const got =
    text.match(REFUSED)?.[0] ?? `${text.length} chars: ${text.slice(0, 80)}`
  return { tool: end?.toolName ?? start?.toolName ?? '', did, got }
}

/** The words a stage is named by: a tool's command, or its own name. */
const command_of = event =>
  String(event.args?.command ?? event.args?.path ?? event.toolName ?? '')
    .replace(/\s+/g, ' ')
    .slice(0, SHOWN)

/**
 * The ways a run fetches a page. A list, a note, or a saved log fetches none.
 * `realness-read` refuses a page off the source's list and off the origins its
 * pages link to, so the run goes on; the wrapper only notes the read.
 */
const FETCHERS = /\b(web-md|curl|wget|agent-browser)\b/

/**
 * The URL a fetching command reads that the source never named and no read
 * page linked to, or '' when it keeps to the source. A run reads its own pages
 * and the origins its pages link to; it may list and grep what it already read.
 * @param {string} command
 * @param {string[]} allowed
 * @param {string[]} hops origins the pages read so far linked to
 */
export const read_outside = (command, allowed, hops = []) =>
  command
    .split(/\|\||&&|[|;\n]/)
    .filter(part => FETCHERS.test(part))
    .flatMap(part => part.match(/https?:\/\/[^\s)'"`\\]+/g) ?? [])
    .map(url => url.replace(/[.,;:]+$/, ''))
    .filter(url => URL.canParse(url))
    .find(
      url =>
        !allowed.some(one => reads_inside(url, one)) && !hops_inside(url, hops)
    ) ?? ''

/** How often the run looks at the model call it is waiting on. */
const WATCH_MS = 5000

/** How much of a command a step line shows. */
const SHOWN = 120

/** A read the site refused: no amount of waiting will change it. */
const REFUSED = /HTTP (401|403)\b/

/**
 * What one line of pi's event stream means for the run: `finds` when pi has
 * written its result, `refused` when a read was refused, `failed` when the
 * model answered with an error, `settled` when pi is done, or null to keep
 * going.
 * @param {string} line
 * @param {string[]} [named] the pages the source names
 * @returns {{ end: 'finds' | 'settled' } | { end: 'refused' | 'failed', reason: string } | null}
 */
export const run_event = (line, named = []) => {
  let event
  try {
    event = JSON.parse(line)
  } catch {
    return null
  }
  if (event.type === 'agent_settled') return { end: 'settled' }
  if (event.type === 'message_end' && event.message?.stopReason === 'error')
    return {
      end: 'failed',
      reason: event.message.errorMessage ?? 'the model failed'
    }
  if (event.type !== 'tool_execution_end') return null
  const text = JSON.stringify(event.result ?? '')
  const refused = text.match(REFUSED)
  if (refused && source_refused(text, named))
    return { end: 'refused', reason: `a read was refused: HTTP ${refused[1]}` }
  const args = JSON.stringify(event.args ?? '')
  if (/finds\.html/.test(args) && /write|edit/i.test(event.toolName ?? ''))
    return { end: 'finds' }
  return null
}

/**
 * pi on this Mac, given the brief. Its own events end the run: the write of
 * finds.html, a refused read, a model error, pi settling, or pi exiting.
 */
export const local_pi =
  (bin = resolve(here, '.pi/bin/pi'), say = () => {}, model = '') =>
  (brief, run_dir, _stage, allowed = []) =>
    new Promise(done => {
      const log = create_write_stream(join(run_dir, 'pi.log'))
      const child = spawn(
        bin,
        [
          '-p',
          '--mode',
          'json',
          '--no-session',
          ...(model ? ['--model', model] : []),
          brief
        ],
        {
          cwd: run_dir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PATH: `${resolve(dirname(file_url_to_path(import.meta.url)), 'bin')}:${process.env.PATH}`,
            REALNESS_READ_ALLOWED: JSON.stringify(allowed),
            REALNESS_READ_HOPS_FILE: join(run_dir, 'hops.json')
          }
        }
      )
      const hops_file = join(run_dir, 'hops.json')
      const hops_now = () => {
        try {
          return JSON.parse(read_file_sync(hops_file, 'utf8'))
        } catch {
          return []
        }
      }
      let ended = null
      let rest = ''
      const began = Date.now()
      const starts = new Map()
      const steps = []
      const steps_page = join(run_dir, 'steps.html')
      const elapsed = () =>
        `${((Date.now() - began) / MS_PER_SECOND).toFixed(1)}s`
      const watch = model_watch({
        say: line => {
          say(`${elapsed()}  ${line}`)
          log.write(`${line}\n`)
        }
      })
      const ticking = setInterval(() => watch.tick(), WATCH_MS)
      const stages_file = join(run_dir, STAGES_PAGE)
      const note = line => {
        let event
        try {
          event = JSON.parse(line)
        } catch {
          return
        }
        watch.event(event)
        if (event.type === 'tool_execution_start' && !ended) {
          const outside = read_outside(
            String(event.args?.command ?? ''),
            allowed,
            hops_now()
          )
          if (outside)
            log.write(
              `a read past the source's list, the reader decides: ${outside}\n`
            )
        }
        if (
          event.type === 'tool_execution_start' ||
          (event.type === 'message_end' && event.message?.role === 'assistant')
        )
          append_file_sync(
            stages_file,
            gzip_sync(
              Buffer.from(
                item_html('stage', {
                  at: String(Date.now()),
                  tool: event.type === 'message_end' ? '' : command_of(event)
                }),
                'utf8'
              )
            )
          )
        if (event.type === 'tool_execution_start')
          starts.set(event.toolCallId, event)
        if (event.type !== 'tool_execution_end') return
        const step = {
          at: `${((Date.now() - began) / MS_PER_SECOND).toFixed(1)}s`,
          ...step_of(starts.get(event.toolCallId), event)
        }
        steps.push(step)
        say(`${step.at}  ${step.tool}  ${step.did}  -> ${step.got}`)
        write_file_sync(
          steps_page,
          `<!doctype html>\n<title>steps</title>\n${steps.map(one => item_html('step', one)).join('')}`
        )
      }
      child.stdout.on('data', chunk => {
        log.write(chunk)
        const lines = (rest + chunk).split('\n')
        rest = lines.pop() ?? ''
        for (const line of lines) {
          note(line)
          const event = run_event(line, allowed)
          if (!event || ended) continue
          ended = event
          if (event.reason) log.write(`${event.reason}\n`)
          child.kill('SIGTERM')
        }
      })
      child.stderr.pipe(log)
      child.on('close', code => {
        clearInterval(ticking)
        log.end()
        done(['finds', 'settled'].includes(ended?.end) ? 0 : (code ?? 1))
      })
    })

/** Every source key a scout's Sources.md names, or one empty key for all. */
const keys_of = page => {
  const doc = (() => {
    try {
      return read_file_sync(join(page.folder, 'Sources.md'), 'utf8')
    } catch {
      return ''
    }
  })()
  const keys = source_sections(doc).map(one => one.key)
  return keys.length ? keys : ['']
}

/**
 * Run every job, at most `limit` at a time; each starts as one ends.
 * @template T, R
 * @param {T[]} jobs
 * @param {number} limit
 * @param {(job: T) => Promise<R>} work
 * @returns {Promise<R[]>}
 */
export const at_most = async (jobs, limit, work) => {
  const results = []
  let next = 0
  const lane = async () => {
    while (next < jobs.length) {
      const at = next
      next += 1
      results[at] = await work(jobs[at])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, lane))
  return results
}

/** `--at-once <n>`, or every job at once. */
const limit_of = (args, jobs) => {
  const at = args.indexOf('--at-once')
  const n = at === -1 ? jobs : Number(args[at + 1])
  if (!Number.isInteger(n) || n < 1)
    throw new Error('--at-once needs a whole number')
  return n
}

/** Every active scout, or the one named on the command line. */
const chosen_scouts = ({ args, vault }) => {
  const named = args.filter(
    (arg, at) =>
      !arg.startsWith('--') &&
      args[at - 1] !== '--source' &&
      args[at - 1] !== '--at-once' &&
      args[at - 1] !== '--model'
  )
  const [requested] = named
  const pages = scout_pages(vault)
  const chosen = requested
    ? [find_scout(pages, requested)]
    : pages.filter(page => page.status === 'active')
  if (!chosen.length)
    throw new Error(
      `no active scout: write a scout.html in a plan folder under ${vault}/Projects`
    )
  return chosen
}

/**
 * @param {object} [options]
 * @param {string[]} [options.args]
 * @param {string} [options.vault] the vault the scouts live in
 * @param {{ write: (line: string) => void }} [options.out]
 * @param {{ write: (line: string) => void }} [options.err]
 * @param {() => Promise<unknown>} [options.ready] the gate before any pi starts
 */
export const main = async ({
  args = process.argv.slice(2),
  vault = vault_dir,
  out = process.stdout,
  err = process.stderr,
  spawn_pi = null,
  ready = box_ready
} = {}) => {
  if (args.includes('--run')) {
    const where = await ready().catch(error => {
      err.write(`not ready: ${error.message}\n`)
      process.exitCode = 1
      return null
    })
    if (!where) return []
    const owner = process.env.REALNESS_PERSON
      ? `/${process.env.REALNESS_PERSON}`
      : person(resolve(vault, '..'))
    const date = new Date().toISOString().slice(0, ISO_DATE)
    const jobs = chosen_scouts({ args, vault }).flatMap(scout =>
      (source_of(args) ? [source_of(args)] : keys_of(scout)).map(source => ({
        scout,
        source
      }))
    )
    const limit = limit_of(args, jobs.length)
    out.write(`starting ${jobs.length} sources, ${limit} at once\n`)
    const results = await at_most(jobs, limit, async ({ scout, source }) => {
      const started = Date.now()
      const line = await run_scout({
        scout: scout.path,
        vault_dir: vault,
        source,
        person: owner,
        date,
        spawn_pi:
          spawn_pi ??
          local_pi(
            undefined,
            step => out.write(`${source || scout.path}  ${step}\n`),
            value_of(args, '--model')
          )
      }).then(
        result => `${result.leads.length} leads`,
        error => `failed: ${error.message.split('\n')[0]}`
      )
      const seconds = Math.round((Date.now() - started) / MS_PER_SECOND)
      const row = `${source || scout.path}  ${seconds}s  ${line}`
      out.write(`${row}\n`)
      return row
    })
    out.write(`done ${results.length} sources\n`)
    return results
  }
  for (const scout of chosen_scouts({ args, vault })) {
    const result = await run_scout({
      scout: scout.path,
      vault_dir: vault,
      source: source_of(args),
      date: new Date().toISOString().slice(0, ISO_DATE),
      dry_run: true
    }).catch(error => {
      err.write(`${error.message}\n`)
      process.exitCode = 1
      return null
    })
    if (result) out.write(`${result.brief}\n`)
  }
}

await run_entry(import.meta.url, main)
