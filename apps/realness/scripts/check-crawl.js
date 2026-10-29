/**
 * What Google sees of the built site agrees with itself.
 *
 * Every sitemap URL is allowed by robots.txt, has its own file, and that
 * file names itself canonical and is indexable. Routes with no file fall
 * through to app.html, which is noindex with no canonical.
 */
import fs from 'node:fs'
import path from 'node:path'
import { frontend_out } from '#root/src/settings/output.js'
import { run_entry } from './lib/entry.js'

const LABEL = 'check-crawl'

/**
 * Google's robots.txt rule: the longest matching pattern wins; Allow wins a tie.
 * @param {string} robots
 * @param {string} pathname
 */
export const robots_allows = (robots, pathname) => {
  let best = { length: -1, allow: true }
  for (const line of robots.split('\n')) {
    const [, verb, pattern] =
      line.trim().match(/^(allow|disallow):\s*(\S*)$/i) ?? []
    if (!verb || !pattern) continue
    const source = pattern
      .replace(/[.+?^{}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\\\$$|\$$/, '$')
    if (!new RegExp(`^${source}`).test(pathname)) continue
    const allow = verb.toLowerCase() === 'allow'
    if (
      pattern.length > best.length ||
      (pattern.length === best.length && allow)
    )
      best = { length: pattern.length, allow }
  }
  return best.allow
}

/**
 * The file the host serves for a path (Firebase, trailingSlash false).
 * @param {string} dist_dir
 * @param {string} pathname
 */
const served_file = (dist_dir, pathname) => {
  const base = path.join(dist_dir, decodeURIComponent(pathname))
  for (const file of [base, `${base}.html`, path.join(base, 'index.html')])
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
  return null
}

const canonical_of = html =>
  html.match(/<link rel="canonical" href="([^"]*)"/i)?.[1] ?? null
const noindex = html => /<meta name="robots" content="[^"]*noindex/i.test(html)

/**
 * @param {string} dist_dir
 * @returns {string[]} problems
 */
export const check_crawl = dist_dir => {
  const read = name => {
    const file = path.join(dist_dir, name)
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  }
  const problems = []
  const robots = read('robots.txt')
  const sitemap = read('sitemap.xml')
  const shell = read('app.html')
  if (robots === null) problems.push('no robots.txt')
  if (sitemap === null) problems.push('no sitemap.xml')
  if (shell === null) problems.push('no app.html shell')
  else {
    if (canonical_of(shell)) problems.push('app.html has a canonical')
    if (!noindex(shell)) problems.push('app.html is not noindex')
  }
  for (const [, loc] of (sitemap ?? '').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const { pathname } = new URL(loc)
    if (robots !== null && !robots_allows(robots, pathname))
      problems.push(`${loc} is in the sitemap but robots.txt blocks it`)
    const file = served_file(dist_dir, pathname)
    if (!file) {
      problems.push(`${loc} has no file; it would get the app shell`)
      continue
    }
    if (!file.endsWith('.html')) continue
    const html = fs.readFileSync(file, 'utf8')
    if (canonical_of(html) !== loc)
      problems.push(`${loc} names ${canonical_of(html)} canonical`)
    if (noindex(html)) problems.push(`${loc} is noindex`)
  }
  return problems
}

/** @param {{ dist_dir?: string }} [options] */
export const main = ({ dist_dir = frontend_out() } = {}) => {
  const problems = check_crawl(dist_dir)
  for (const problem of problems) console.error(`${LABEL}: ${problem}`)
  if (problems.length)
    throw new Error(`${LABEL}: ${problems.length} problem(s)`)
  console.info(`${LABEL}: sitemap, robots.txt, and canonicals agree`)
}

run_entry(import.meta.url, main)
