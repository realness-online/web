#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { readFileSync as read_file_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join } from 'node:path'
import { averages, base_prompt, here, make_out_dir, pi, pool, root, variants_from, write_variants } from './lib.js'

const learnings = process.env.LEARNINGS === '1'
const repeats = Number(process.env.REPEATS ?? 1)
const set = process.env.PROMPTS ?? 'voice'
const prompts = JSON.parse(read_file_sync(join(here, 'prompts', `${set}.json`), 'utf8'))
const metrics = (
  process.env.METRICS ?? 'words,non_ascii,praise,preamble,headings,restate,camel,semis,comments,classes'
).split(',')

/** @param {string} answer */
const unexplained_acronyms = answer => {
  const prose = answer.replace(/```[\s\S]*?```|`[^`]*`/g, '')
  const found = new Set(prose.match(/\b[A-Z]{2,5}\b/g) ?? [])
  return [...found].filter(a => !new RegExp(`\\(${a}\\)|${a} \\(`).test(prose)).length
}

/** @param {string} answer */
const score = answer => {
  const first = answer.trim().split('\n')[0] ?? ''
  const code = [...answer.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(m => m[1]).join('\n')
  const bullets = answer.match(/^\s*[-*] .+$/gm) ?? []
  return {
    words: answer.split(/\s+/).filter(Boolean).length,
    non_ascii: (answer.match(/[\u2013\u2014\u2018\u2019\u201c\u201d\u2026]/g) ?? []).length,
    praise: /\b(congrat|nice work|great (question|idea|work|job)|well done|happy to)/i.test(answer) ? 1 : 0,
    preamble: /^(sure|okay|ok|let me|i'll|i will|great|certainly|of course)\b/i.test(first) ? 1 : 0,
    headings: (answer.match(/^#+ /gm) ?? []).length,
    restate: /^(you want|you're asking|you are asking|so you|it sounds like|you'd like)\b/i.test(first) ? 1 : 0,
    asks: /\?\s*$/m.test(answer) ? 1 : 0,
    bullets: bullets.length,
    bullet_words: bullets.length
      ? bullets.reduce((s, b) => s + b.trim().split(/\s+/).length - 1, 0) / bullets.length
      : 0,
    plan_words: (answer.match(/\b(DAG|gate|explorer|planner|worker|critic|promoter)\b/gi) ?? []).length,
    camel: (code.match(/\b(?:const|let|var|function)\s+[a-z]+[A-Z]\w*/g) ?? []).length,
    semis: (code.match(/;\s*$/gm) ?? []).length,
    comments: (code.match(/(^|\s)\/\/|\/\*(?!\*)|<!--/gm) ?? []).length,
    classes: (code.match(/\bclass="/g) ?? []).length,
    x_not_y: (answer.match(/,\s+not\s+[^.,\n]+[.!]?\s*$/gim) ?? []).length,
    acronyms: unexplained_acronyms(answer),
    hex: (code.match(/#[0-9a-f]{3,8}\b/gi) ?? []).length,
    prettier: /prettier/i.test(answer) ? 1 : 0,
    vp: /\bvp fmt\b/.test(answer) ? 1 : 0
  }
}

/**
 * @param {string} system
 * @param {string} prompt
 * @returns {Promise<string>}
 */
const ask = (system, prompt) =>
  new Promise((resolve, reject) => {
    const args = ['-p', '--no-session', '--no-tools', '--append-system-prompt', system, prompt]
    const child = spawn(pi, args, {
      cwd: learnings ? '/' : root,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    let out = ''
    child.stdout.on('data', d => (out += d))
    const timer = setTimeout(() => child.kill('SIGTERM'), 180_000)
    child.on('close', code => {
      clearTimeout(timer)
      code === 0 ? resolve(out) : reject(new Error(`pi exited ${code}: ${prompt}`))
    })
  })

const variants = variants_from(process.argv.slice(2), base_prompt(learnings))
const out_dir = make_out_dir('text')
write_variants(out_dir, variants)

const jobs = variants.flatMap(v =>
  prompts.flatMap((/** @type {string} */ prompt, /** @type {number} */ i) =>
    Array.from({ length: repeats }, (_, r) => async () => {
      const answer = await ask(join(out_dir, `${v.name}.md`), prompt)
      write_file_sync(join(out_dir, `${v.name}-${i}-${r}.txt`), `${prompt}\n\n---\n\n${answer}`)
      console.error(`done ${v.name} #${i}.${r}`)
      return { variant: v.name, prompt: i, repeat: r, ...score(answer) }
    })
  )
)
const rows = await pool(jobs, 4)
write_file_sync(join(out_dir, 'scores.json'), JSON.stringify(rows, null, 2))
console.table(
  averages(
    rows,
    variants.map(v => v.name),
    metrics
  )
)
console.log(out_dir)
