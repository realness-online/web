import { spawn } from 'node:child_process'
import {
  mkdir,
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { card_html } from '../../tools/publish/renderer/static/scripts/parts.js'
import { artifacts_dir } from './lib/artifacts.js'
import { is_entry } from './lib/entry.js'

const here = path.dirname(file_url_to_path(import.meta.url))
const harness = path.resolve(here, '../../../..')
const chat_prompt = path.resolve(
  here,
  '../../server/halo/guest/realness-chat.md'
)
const PRODUCER = 'realness/inkling'
const JUDGE = 'openai-codex/gpt-6-sol'
const PARALLEL = 4
const MIN_FORM = 0.9
const KIND_WIDTH = 8
const MARK_WIDTH = 14
const PROMPT_WIDTH = 56

const option = (args, name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at === -1 ? fallback : Number(args[at + 1])
}

/**
 * One Pi turn, no session kept, run from the harness so its skills load.
 * Stdin stays closed: print mode reads a piped stdin before it answers.
 */
export const pi = (model, message, extra = [], run = spawn) =>
  new Promise((resolve, reject) => {
    const child = run(
      'pi',
      ['-p', '--no-session', '--model', model, ...extra, message],
      {
        cwd: harness,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 240_000
      }
    )
    let out = ''
    let err = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', chunk => (err += chunk))
    child.on('error', reject)
    child.on('close', code =>
      code === 0
        ? resolve(out.trim())
        : reject(
            new Error(`${model} exit ${code}: ${err.trim().split('\n').at(-1)}`)
          )
    )
  })

/** The form a reply took, read from its Markdown. */
export const form_of = reply => {
  if (/```mermaid\b/i.test(reply)) return 'diagram'
  if (/```cardlink\b/i.test(reply)) return 'card'
  if (/^\s*\|.*\|\s*$/m.test(reply) && /^\s*\|[\s:|-]+\|\s*$/m.test(reply))
    return 'table'
  return 'text'
}

/** Every cardlink fence in a reply draws as a card. */
export const cards_draw = reply =>
  [...reply.matchAll(/```cardlink\n([\s\S]*?)```/gi)].every(
    ([, body]) => card_html(body, { images: false }) !== null
  )

const judge_prompt = (
  prompt,
  reply
) => `You grade one chat reply. The chat draws Markdown, mermaid diagrams, and cardlink link cards. Plain text is best when it is enough; a table suits comparisons, a diagram suits flows of four or more steps, a card suits one page worth opening.

Question:
${prompt}

Reply:
${reply}

Answer with JSON only, no fence: {"clarity":1-5,"usefulness":1-5,"completeness":1-5,"fit":"right"|"overbuilt"|"underbuilt","note":"one short sentence"}`

const parse_grade = text => {
  const found = text.match(/\{[\s\S]*\}/)
  try {
    return found ? JSON.parse(found[0]) : null
  } catch {
    return null
  }
}

/** Run jobs a few at a time. */
export const pooled = async (jobs, size) => {
  const results = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const at = next++
      results[at] = await jobs[at]()
    }
  }
  await Promise.all(Array.from({ length: size }, worker))
  return results
}

const grade = async ({ kind, prompt }, context, pi) => {
  const message = `[Chat context]\n${context}\n[Message]\n${prompt}`
  try {
    const reply = await pi(PRODUCER, message).catch(() => pi(PRODUCER, message))
    const form = form_of(reply)
    const judged = parse_grade(
      await pi(JUDGE, judge_prompt(prompt, reply), ['--no-skills'])
    )
    return {
      kind,
      prompt,
      form,
      right_form: form === kind,
      cards_draw: cards_draw(reply),
      judged,
      reply
    }
  } catch (thrown) {
    return { kind, prompt, error: thrown.message.split('\n')[0] }
  }
}

const mean = values =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

/**
 * Ask the producer each prompt, have the judge grade it, and save the run.
 * @param {{ args?: string[], ask?: typeof pi, out_dir?: string }} [options]
 */
export const main = async ({
  args = process.argv.slice(2),
  ask = pi,
  out_dir = path.join(artifacts_dir, 'chat-parts-eval')
} = {}) => {
  const runs = option(args, 'runs', 1)
  const min = option(args, 'min', MIN_FORM)
  const prompts = JSON.parse(
    await read_file(path.join(here, 'chat-parts-prompts.json'), 'utf8')
  )
  const context = await read_file(chat_prompt, 'utf8')
  const jobs = prompts.flatMap(item =>
    Array.from({ length: runs }, () => () => grade(item, context, ask))
  )
  const results = await pooled(jobs, PARALLEL)

  const done = results.filter(result => !result.error)
  const judged = done.filter(result => result.judged)
  const score = name =>
    mean(judged.map(result => Number(result.judged[name]) || 0))
  const summary = {
    producer: PRODUCER,
    judge: JUDGE,
    replies: results.length,
    errors: results.length - done.length,
    form_accuracy: done.length
      ? done.filter(result => result.right_form).length / done.length
      : 0,
    cards_draw: done.every(result => result.cards_draw),
    clarity: score('clarity'),
    usefulness: score('usefulness'),
    completeness: score('completeness'),
    fit: Object.fromEntries(
      ['right', 'overbuilt', 'underbuilt'].map(fit => [
        fit,
        judged.filter(result => result.judged.fit === fit).length
      ])
    )
  }

  for (const result of results) {
    const mark_of = result => {
      if (result.error) return 'error'
      return result.right_form ? 'ok' : `got ${result.form}`
    }
    const mark = mark_of(result)
    const fit = result.judged ? ` · ${result.judged.fit}` : ''
    console.info(
      `${result.kind.padEnd(KIND_WIDTH)}${mark.padEnd(MARK_WIDTH)}${result.prompt.slice(0, PROMPT_WIDTH)}${fit}`
    )
  }
  const fixed = n => n.toFixed(2)
  console.info(
    `\nform ${fixed(summary.form_accuracy)} · clarity ${fixed(summary.clarity)} · usefulness ${fixed(summary.usefulness)} · completeness ${fixed(summary.completeness)} · cards draw ${summary.cards_draw} · errors ${summary.errors}`
  )

  await mkdir(out_dir, { recursive: true })
  const out = path.join(
    out_dir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  )
  await write_file(out, `${JSON.stringify({ summary, results }, null, 2)}\n`)
  console.info(path.relative(harness, out))
  const passed =
    summary.form_accuracy >= min && !summary.errors && summary.cards_draw
  if (!passed) process.exitCode = 1
  return { summary, results, out, passed }
}

if (is_entry(import.meta.url)) await main()
