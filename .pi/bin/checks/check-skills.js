#!/usr/bin/env node

import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync, readdirSync as readdir_sync, readFileSync as read_file_sync, statSync as stat_sync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { promisify } from 'node:util'
import { python_command } from '../lib/python.js'

const run = promisify(exec_file)
const root = join(dirname(file_url_to_path(import.meta.url)), '../../..')
const skills_root = [join(root, '.pi/skills'), join(root, 'skills')].find(dir => exists_sync(dir))
const validator = join(skills_root, 'skill-writer/scripts/quick-validate.js')
export const MAX_BLOCK_LINES = 15

const is_dir = path => {
  try {
    return stat_sync(path).isDirectory()
  } catch {
    return false
  }
}

/** Markdown outside fenced code blocks, plus the line count of each block. */
export const split_fences = markdown => {
  const prose = []
  const blocks = []
  let inside = false
  let count = 0
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) {
      if (inside) blocks.push(count)
      inside = !inside
      count = 0
    } else if (inside) count++
    else prose.push(line)
  }
  return { prose: prose.join('\n'), blocks }
}

/** Backticked paths and relative link targets that name a file or folder. */
export const path_claims = prose => {
  const spans = [...prose.matchAll(/`([^`\n]+)`/g)].map(m => m[1])
  const links = [...prose.matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1].split('#')[0])
  return [...new Set([...spans, ...links])]
    .map(text => text.trim().replace(/:\d+$/, '').replace(/[.,;]$/, ''))
    .filter(
      text =>
        text.includes('/') &&
        !/[\s<>*$~{}|?=@"'()]/.test(text) &&
        !/^(\/|\.\.|[a-z]+:)/i.test(text)
    )
}

/**
 * A claim is checked only when its first segment exists next to the skill or
 * at the harness root, so `owner/repo` or `a/b` prose is ignored. Paths into
 * work/<project>/ are checked only when that project is on this machine.
 * Derived state is skipped: a fresh build has not made it yet.
 */
export const missing_paths = (skill_dir, harness_root, claims) =>
  claims.filter(claim => {
    const clean = claim.replace(/^\.\//, '')
    const [first, second] = clean.split('/')
    if (is_derived(clean)) return false
    const bases = [skill_dir, harness_root].filter(base => exists_sync(join(base, first)))
    if (!bases.length) return false
    if (first === 'work' && second && !exists_sync(join(harness_root, 'work', second)))
      return false
    return !bases.some(base => exists_sync(join(base, clean)))
  })

/**
 * Paths the harness creates at runtime, absent from a fresh build. A skill
 * naming one is correct; there is nothing to check until first use.
 */
export const DERIVED = ['.pi/agent/memory.db']

const is_derived = path => DERIVED.some(derived => path === derived || path.startsWith(`${derived}/`))

const SYNTAX = {
  '.js': file => ['node', ['--check', file]],
  '.cjs': file => ['node', ['--check', file]],
  '.sh': file => ['bash', ['-n', file]],
  '.py': file => [python_command(), ['-c', 'import ast,sys; ast.parse(open(sys.argv[1]).read())', file]]
}

const script_files = dir =>
  readdir_sync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return ['node_modules', 'published', '.git'].includes(entry.name) ? [] : script_files(path)
    return SYNTAX[extname(entry.name)] ? [path] : []
  })

/** The `check:` line inside the frontmatter's `metadata:` block, or null. */
export const check_command = markdown => {
  const front = markdown.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  const block = front.match(/^metadata:\n((?:[ \t]+.*\n?)*)/m)?.[1] ?? ''
  const raw = block.match(/^[ \t]+check:[ \t]*(.+)$/m)?.[1].trim()
  if (!raw) return null
  if (/^'.*'$/.test(raw)) return raw.slice(1, -1).replace(/''/g, "'")
  if (/^".*"$/.test(raw)) return raw.slice(1, -1)
  return raw
}

/** What a skill's check needs beyond the shell, from `metadata.needs`: 'browser', or null. */
export const check_needs = markdown => {
  const front = markdown.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  const block = front.match(/^metadata:\n((?:[ \t]+.*\n?)*)/m)?.[1] ?? ''
  return block.match(/^[ \t]+needs:[ \t]*['"]?(\w+)/m)?.[1] ?? null
}

/** Run a skill's check from its own folder; an error message, or null. A browser check may lease a Chrome first. */
export const run_check = async (skill_dir, command, { timeout = 60_000 } = {}) => {
  try {
    await run('bash', ['-c', command], { cwd: skill_dir, timeout })
    return null
  } catch (error) {
    const killed = error.killed || error.signal ? `killed by ${error.signal ?? 'timeout'}` : null
    const detail = killed ?? String(error.stderr || error.stdout || '').trim().split('\n').filter(Boolean).at(-1)
    return `check failed: ${command}${detail ? ` (${detail})` : ''}`
  }
}

/** Realness checks for one skill folder. */
export const check_skill = async (skill_dir, harness_root = root) => {
  const errors = []
  const warnings = []
  const markdown = read_file_sync(join(skill_dir, 'SKILL.md'), 'utf8')
  const { prose, blocks } = split_fences(markdown)

  if (!check_command(markdown)) errors.push('no metadata.check: one cheap command that proves the skill works')

  for (const claim of missing_paths(skill_dir, harness_root, path_claims(prose)))
    warnings.push(`names \`${claim}\`, which does not exist`)

  const long = blocks.filter(lines => lines > MAX_BLOCK_LINES)
  if (long.length)
    warnings.push(
      `${long.length} code block${long.length === 1 ? '' : 's'} over ${MAX_BLOCK_LINES} lines ` +
        `(longest ${Math.max(...long)}); move long scripts to scripts/`
    )

  await Promise.all(
    script_files(skill_dir).map(async file => {
      const [command, args] = SYNTAX[extname(file)](file)
      try {
        await run(command, args)
      } catch (error) {
        const detail = String(error.stderr || error.message).trim().split('\n').find(Boolean)
        errors.push(`${file.slice(skill_dir.length + 1)} does not parse: ${detail}`)
      }
    })
  )

  return { errors, warnings, name: markdown.match(/^name:\s*["']?([^"'\n]+)/m)?.[1].trim() }
}

/** Run the spec validator with the current Node executable. */
export const spec_check = async skill_dir => {
  try {
    const { stdout } = await run(process.execPath, [validator, skill_dir])
    return JSON.parse(stdout)
  } catch (error) {
    try {
      return JSON.parse(error.stdout)
    } catch {
      return { errors: [String(error.stderr || error.message).trim()], warnings: [] }
    }
  }
}

const main = async () => {
  const args = process.argv.slice(2)
  const run_checks = args.includes('--run')
  const no_browser = args.includes('--no-browser')
  const wanted = args.filter(arg => !arg.startsWith('--'))
  const names = readdir_sync(skills_root)
    .filter(name => exists_sync(join(skills_root, name, 'SKILL.md')))
    .filter(name => !wanted.length || wanted.includes(name))
    .sort()

  const results = await Promise.all(
    names.map(async name => {
      const dir = join(skills_root, name)
      const [spec, house] = await Promise.all([spec_check(dir), check_skill(dir)])
      return {
        name,
        declared: house.name,
        spec,
        errors: [...(spec?.errors ?? []), ...house.errors],
        warnings: [...(spec?.warnings ?? []), ...house.warnings]
      }
    })
  )

  if (run_checks)
    for (const result of results) {
      const dir = join(skills_root, result.name)
      const markdown = read_file_sync(join(dir, 'SKILL.md'), 'utf8')
      const command = check_command(markdown)
      const browser = check_needs(markdown) === 'browser'
      if (browser && no_browser) {
        result.skipped = 'needs a browser'
        continue
      }
      const failed = command && (await run_check(dir, command, { timeout: browser ? 240_000 : 60_000 }))
      if (failed) result.errors.push(failed)
    }

  const by_name = Map.groupBy(results, r => r.declared)
  for (const [declared, group] of by_name)
    if (declared && group.length > 1)
      for (const r of group)
        r.errors.push(`name "${declared}" is also used by ${group.filter(g => g !== r).map(g => g.name).join(', ')}`)

  for (const { name, errors, warnings } of results) {
    if (!errors.length && !warnings.length) continue
    console.log(`${name}`)
    for (const e of errors) console.log(`  error    ${e}`)
    for (const w of warnings) console.log(`  warning  ${w}`)
  }

  const failed = results.filter(r => r.errors.length).length
  const warned = results.filter(r => !r.errors.length && r.warnings.length).length
  const no_check = results.filter(r => r.skipped)
  if (no_check.length) console.log(`checks not run here: ${no_check.map(r => `${r.name} (${r.skipped})`).join(', ')}`)
  console.log(
    `\n${results.length} skills: ${results.length - failed - warned} clean, ${warned} with warnings, ${failed} with errors`
  )
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && basename(process.argv[1]) === basename(file_url_to_path(import.meta.url))) await main()
