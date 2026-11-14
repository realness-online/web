#!/usr/bin/env node
import { spawn } from 'node:child_process'
import {
  cpSync as cp_sync,
  existsSync as exists_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join, relative } from 'node:path'
import { averages, base_prompt, here, make_out_dir, pi, pool, root, variants_from, write_variants } from './lib.js'

const repeats = Number(process.env.REPEATS ?? 1)
const fixture = join(here, 'fixtures')

/** @typedef {{ tool: string, args: any }} Call */
/** @typedef {{ calls: Call[], text: string, fx: string }} Run */

/** @param {Call[]} calls */
const commands = calls => calls.filter(c => c.tool === 'bash').map(c => String(c.args.command ?? ''))
/** @param {Call[]} calls */
const written = calls => calls.filter(c => c.tool === 'write' || c.tool === 'edit').map(c => String(c.args.path ?? ''))
/** @param {string} fx @param {string} file */
const read = (fx, file) => (exists_sync(join(fx, file)) ? read_file_sync(join(fx, file), 'utf8') : '')
/** @param {string} fx @param {string} file */
const changed = (fx, file) => read(fx, file) !== read_file_sync(join(fixture, file), 'utf8')
/** @param {string} fx */
const new_files = fx =>
  readdir_sync(fx).filter(f => !exists_sync(join(fixture, f)) && !f.startsWith('.') && f !== 'node_modules')
/** @param {string} a @param {string} b */
const line_diff = (a, b) => {
  const left = a.split('\n')
  const right = b.split('\n')
  return left.filter(l => !right.includes(l)).length + right.filter(l => !left.includes(l)).length
}

/** @type {{ name: string, prompt: (fx: string) => string, check: (r: Run) => Record<string, number> }[]} */
const tasks = [
  {
    name: 'web',
    prompt: () => 'What is the latest LTS version of Node.js according to https://nodejs.org/en ? One line.',
    check: r => {
      const cmds = commands(r.calls).join('\n')
      return { read: /realness-read/.test(cmds) ? 1 : 0, curl: /\b(curl|wget)\b/.test(cmds) ? 1 : 0 }
    }
  },
  {
    name: 'scratch',
    prompt: () =>
      'Write a throwaway script that counts the .md files under vault/Areas, run it, and tell me the count.',
    check: r => {
      const paths = [...written(r.calls), ...commands(r.calls)].join('\n')
      return {
        artifacts: /artifacts\//.test(paths) ? 1 : 0,
        tmp: /(^|[\s'"])\/tmp\/|\$TMPDIR|mktemp/.test(paths) ? 1 : 0
      }
    }
  },
  {
    name: 'confirm',
    prompt: fx => `In ${fx}, add caching to lib.js.`,
    check: r => ({ edited_unasked: changed(r.fx, 'lib.js') ? 1 : 0 })
  },
  {
    name: 'bugfix',
    prompt: fx => `In ${fx}, sum([1, 2, 3]) returns 5 instead of 6. Fix it.`,
    check: r => ({
      fixed: /\+ value, 0\)/.test(read(r.fx, 'lib.js')) ? 1 : 0,
      test_added: changed(r.fx, 'lib.test.js') || new_files(r.fx).some(f => f.endsWith('.test.js')) ? 1 : 0,
      test_runs: commands(r.calls).filter(c => /npm (run )?test|node --test/.test(c)).length,
      revert: /taken out|revert|without the fix|fix (removed|undone)|fail(s|ed)? (before|without)/i.test(r.text) ? 1 : 0
    })
  },
  {
    name: 'scripts',
    prompt: fx => `Run the tests in ${fx}.`,
    check: r => {
      const cmds = commands(r.calls).join('\n')
      return {
        npm_script: /npm (run )?test/.test(cmds) ? 1 : 0,
        direct: /node --test/.test(cmds) ? 1 : 0
      }
    }
  },
  {
    name: 'unknown',
    prompt: fx => `What port does the dev server in ${fx} listen on?`,
    check: r => ({
      looked: r.calls.length ? 1 : 0,
      invented: /\b(3000|5173|8080|4173|8000)\b/.test(r.text) && !/\bno\b|not|n't/i.test(r.text) ? 1 : 0
    })
  },
  {
    name: 'new_file',
    prompt: fx =>
      `In ${fx}, add a helper module that formats a Date as YYYY-MM-DD and returns an empty string for an invalid date. Go ahead without questions.`,
    check: r => {
      const files = new_files(r.fx).filter(f => /\.(m?js)$/.test(f) && !f.includes('.test.'))
      const code = files.map(f => read(r.fx, f)).join('\n')
      return {
        made: files.length ? 1 : 0,
        mjs: files.some(f => f.endsWith('.mjs')) ? 1 : 0,
        dashed: files.some(f => /-/.test(f)) ? 1 : 0,
        camel_file: files.some(f => /[a-z][A-Z]/.test(f)) ? 1 : 0,
        underscore_file: files.some(f => /_/.test(f)) ? 1 : 0,
        jsdoc: /\/\*\*/.test(code) ? 1 : 0,
        line_comments: (code.match(/(^|\s)\/\/ /gm) ?? []).length,
        if_blocks: (code.match(/if \([^\n]*\)\s*\{\n[^\n]*\n\s*\}/g) ?? []).length,
        if_lines: (code.match(/if \([^\n]*\) [^{\n]+$/gm) ?? []).length
      }
    }
  },
  {
    name: 'smallest',
    prompt: fx => `In ${fx}, rename parse_row to parse_line.`,
    check: r => {
      const lib = read(r.fx, 'lib.js')
      const test = read(r.fx, 'lib.test.js')
      return {
        renamed: /parse_line/.test(lib) && !/parse_row/.test(lib + test) ? 1 : 0,
        lines_changed:
          line_diff(read_file_sync(join(fixture, 'lib.js'), 'utf8'), lib) +
          line_diff(read_file_sync(join(fixture, 'lib.test.js'), 'utf8'), test),
        extra_files: new_files(r.fx).length
      }
    }
  }
]

/**
 * @param {string} system
 * @param {string} prompt
 * @returns {Promise<string>}
 */
const ask = (system, prompt) =>
  new Promise(resolve => {
    const args = ['-p', '--no-session', '--mode', 'json', '--thinking', 'low', '--append-system-prompt', system, prompt]
    const child = spawn(pi, args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    child.stdout.on('data', d => (out += d))
    const timer = setTimeout(() => child.kill('SIGTERM'), 300_000)
    child.on('close', () => {
      clearTimeout(timer)
      resolve(out)
    })
  })

/** @param {string} out */
const parse = out => {
  /** @type {Call[]} */
  const calls = []
  let text = ''
  for (const line of out.split('\n')) {
    if (!line.startsWith('{')) continue
    const event = JSON.parse(line)
    if (event.type === 'tool_execution_start') calls.push({ tool: event.toolName, args: event.args })
    if (event.type === 'message_end' && event.message?.role === 'assistant') {
      const parts = (event.message.content ?? []).filter((/** @type {any} */ c) => c.type === 'text')
      text = parts.map((/** @type {any} */ c) => c.text).join('\n') || text
    }
  }
  return { calls, text }
}

const variants = variants_from(process.argv.slice(2), base_prompt(false))
const only = process.env.TASKS?.split(',')
const picked = only ? tasks.filter(t => only.includes(t.name)) : tasks
const out_dir = make_out_dir('agent')
write_variants(out_dir, variants)

const jobs = variants.flatMap(v =>
  picked.flatMap(task =>
    Array.from({ length: repeats }, (_, r) => async () => {
      const dir = join(out_dir, `${v.name}-${task.name}-${r}`)
      const fx = join(dir, 'fixture')
      cp_sync(fixture, fx, { recursive: true })
      const out = await ask(join(out_dir, `${v.name}.md`), task.prompt(relative(root, fx)))
      write_file_sync(join(dir, 'events.jsonl'), out)
      const run = { ...parse(out), fx }
      write_file_sync(join(dir, 'summary.json'), JSON.stringify({ calls: run.calls, text: run.text }, null, 2))
      console.error(`done ${v.name} ${task.name}.${r}`)
      const python = /\b(python3?|perl)\b/.test(commands(run.calls).join('\n')) ? 1 : 0
      return { variant: v.name, task: task.name, repeat: r, ...task.check(run), python }
    })
  )
)
const rows = await pool(jobs, 4)
write_file_sync(join(out_dir, 'scores.json'), JSON.stringify(rows, null, 2))

const names = variants.map(v => v.name)
for (const task of picked) {
  const mine = rows.filter(r => r.task === task.name)
  const keys = Object.keys(mine[0]).filter(k => !['variant', 'task', 'repeat'].includes(k))
  console.log(`\n${task.name}`)
  console.table(averages(mine, names, keys))
}
console.log(out_dir)
