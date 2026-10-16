import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../scripts/lib/artifacts.js'

const child = { code: 0, out: '', err: '', fail: null, calls: [] }
const spawn = (command, args, options) => {
  child.calls.push({ command, args, options })
  const process = new EventEmitter()
  process.stdout = new EventEmitter()
  process.stderr = new EventEmitter()
  queueMicrotask(() => {
    if (child.fail) return process.emit('error', child.fail)
    process.stdout.emit('data', child.out)
    process.stderr.emit('data', child.err)
    process.emit('close', child.code)
  })
  return process
}

const { cards_draw, form_of, main, pi, pooled } =
  await import('../../scripts/chat-parts-eval.js')
const prompts = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, '../../scripts/chat-parts-prompts.json'),
    'utf8'
  )
)

const reply_for = kind =>
  ({
    text: 'Plain answer.',
    table: '| a | b |\n| - | - |\n| 1 | 2 |',
    diagram: '```mermaid\nflowchart TD\nA-->B\n```',
    card: '```cardlink\nurl: https://example.com\ntitle: Example\n```'
  })[kind]

const grade =
  '{"clarity":4,"usefulness":5,"completeness":3,"fit":"right","note":"ok"}'

/** A producer that answers in the asked form, and a judge that grades it. */
const right_form = async (model, message) => {
  if (model.startsWith('openai')) return `Grade: ${grade}`
  const prompt = message.split('[Message]\n')[1]
  return reply_for(prompts.find(item => item.prompt === prompt).kind)
}

let out_dir
beforeEach(() => {
  mkdirSync(artifacts_dir, { recursive: true })
  out_dir = mkdtempSync(path.join(artifacts_dir, 'chat-parts-eval-'))
  vi.spyOn(console, 'info').mockImplementation(() => {})
  Object.assign(child, { code: 0, out: '', err: '', fail: null, calls: [] })
})

afterEach(() => {
  rmSync(out_dir, { recursive: true, force: true })
  process.exitCode = undefined
  vi.restoreAllMocks()
})

describe('form_of', () => {
  it.each(['text', 'table', 'diagram', 'card'])('reads a %s reply', kind => {
    expect(form_of(reply_for(kind))).toBe(kind)
  })
})

describe('cards_draw', () => {
  it('needs every card to have a web link', () => {
    expect(cards_draw(reply_for('card'))).toBe(true)
    expect(cards_draw('```cardlink\nurl: nope\n```')).toBe(false)
    expect(cards_draw('no cards')).toBe(true)
  })
})

describe('pooled', () => {
  it('keeps result order with limited overlap', async () => {
    let running = 0
    let most = 0
    const jobs = [3, 1, 2, 0].map(value => async () => {
      most = Math.max(most, ++running)
      await new Promise(resolve => setTimeout(resolve, value))
      running--
      return value
    })
    expect(await pooled(jobs, 2)).toEqual([3, 1, 2, 0])
    expect(most).toBe(2)
  })
})

describe('pi', () => {
  it('runs one print-mode turn and trims its output', async () => {
    child.out = ' answer \n'
    expect(await pi('m', 'hello', ['--no-skills'], spawn)).toBe('answer')
    const [{ command, args, options }] = child.calls
    expect(command).toBe('pi')
    expect(args).toEqual([
      '-p',
      '--no-session',
      '--model',
      'm',
      '--no-skills',
      'hello'
    ])
    expect(options.stdio[0]).toBe('ignore')
  })

  it('rejects with the last stderr line on failure', async () => {
    Object.assign(child, { code: 2, err: 'first\nlast words\n' })
    await expect(pi('m', 'x', [], spawn)).rejects.toThrow(
      'm exit 2: last words'
    )
  })

  it('rejects when pi cannot start', async () => {
    child.fail = new Error('ENOENT')
    await expect(pi('m', 'x', [], spawn)).rejects.toThrow('ENOENT')
  })
})

describe('main', () => {
  it('passes when every reply takes the asked form', async () => {
    const { summary, passed, out } = await main({
      args: [],
      ask: right_form,
      out_dir
    })
    expect(passed).toBe(true)
    expect(process.exitCode).toBeUndefined()
    expect(summary).toMatchObject({
      replies: prompts.length,
      errors: 0,
      form_accuracy: 1,
      cards_draw: true,
      clarity: 4,
      usefulness: 5,
      completeness: 3,
      fit: { right: prompts.length, overbuilt: 0, underbuilt: 0 }
    })
    expect(JSON.parse(readFileSync(out, 'utf8')).summary).toEqual(summary)
  })

  it('repeats prompts for --runs', async () => {
    const { summary } = await main({
      args: ['--runs', '2'],
      ask: right_form,
      out_dir
    })
    expect(summary.replies).toBe(prompts.length * 2)
  })

  it('fails on wrong forms, ungraded replies, and errors', async () => {
    const ask = async (model, message) => {
      if (model.startsWith('openai')) return 'not json {'
      if (message.endsWith(prompts[0].prompt)) throw new Error('down\nmore')
      return 'just text'
    }
    const { summary, results, passed } = await main({
      args: ['--min', '0'],
      ask,
      out_dir
    })
    expect(passed).toBe(false)
    expect(process.exitCode).toBe(1)
    expect(summary.form_accuracy).toBeLessThan(1)
    expect(summary.clarity).toBe(0)
    expect(results.some(result => result.judged === null)).toBe(true)
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/got text/))
  })

  it('records a prompt whose producer fails twice', async () => {
    const ask = async () => {
      throw new Error('offline\ntrace')
    }
    const { summary, results } = await main({ args: [], ask, out_dir })
    expect(summary.errors).toBe(prompts.length)
    expect(summary.form_accuracy).toBe(0)
    expect(results[0].error).toBe('offline')
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/error/))
  })
})
