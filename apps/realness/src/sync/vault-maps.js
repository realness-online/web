/**
 * v3f: the map pages keep their data in the vault. This lifts the data
 * literals out of each page's script and reads them, so the app can draw them.
 */
import vm from 'node:vm'

/** The text of one `const <name> = ...` literal, from its opening bracket to its close. */
const literal_of = (source, name) => {
  const start = source.indexOf(`const ${name} = `)
  if (start < 0) return ''
  let index = source.indexOf('=', start) + 1
  let depth = 0
  let quote = ''
  for (; index < source.length; index++) {
    const char = source[index]
    if (quote) {
      if (char === '\\') index++
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '[' || char === '{') depth++
    else if (char === ']' || char === '}') {
      depth--
      if (depth === 0)
        return source.slice(source.indexOf('=', start) + 1, index + 1)
    }
  }
  return ''
}

/**
 * The named data literals, read in the order the file writes them, so one may
 * name another. The context holds no globals.
 * @param {string} source
 * @param {string[]} names
 * @returns {Record<string, any>}
 */
const literals_of = (source, names) => {
  const context = vm.createContext(Object.create(null))
  for (const name of names) {
    const literal = literal_of(source, name)
    if (literal) vm.runInContext(`this.${name} = (${literal})`, context)
  }
  return Object.fromEntries(
    Object.entries(context).map(([name, value]) => [
      name,
      structuredClone(value)
    ])
  )
}

/**
 * @typedef {{ concerns: string[], avatars: Record<string, string>, fates: Record<string, string>, modules: object[], patterns: string[], questions: string[] }} ModulesData
 * @typedef {{ columns: [string, string][], avatars: object[], rows: object[], patterns: string[], questions: string[], statuses: string[] }} WaysInData
 */

const NAMES = [
  'concerns',
  'avatars',
  'all_people',
  'fates',
  'modules',
  'columns',
  'orgs',
  'rows',
  'patterns',
  'questions',
  'statuses'
]

/** The modules map page's data. @param {string} source @returns {ModulesData} */
export const modules_data = source => {
  const data = literals_of(source, NAMES)
  return {
    concerns: data.concerns ?? [],
    avatars: data.avatars ?? {},
    fates: data.fates ?? {},
    modules: data.modules ?? [],
    patterns: data.patterns ?? [],
    questions: data.questions ?? []
  }
}

/** The ways in map page's data. @param {string} source @returns {WaysInData} */
export const ways_in_data = source => {
  const data = literals_of(source, NAMES)
  return {
    columns: data.columns ?? [],
    avatars: data.avatars ?? [],
    rows: data.rows ?? [],
    patterns: data.patterns ?? [],
    questions: data.questions ?? [],
    statuses: data.statuses ?? []
  }
}

/** One tag's text, its own tags dropped. @param {string} html */
const words = html =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The prose a map page writes around its table: its intro, glossary, and
 * decisions. The words stay in the vault.
 * @param {string} html the map page markup
 * @returns {{ intro: string, glossary: {term: string, detail: string}[], decisions: string[] }}
 */
export const map_prose = html => {
  const header = /<header>([\s\S]*?)<\/header>/.exec(html)?.[1] ?? ''
  const intro = /<p>([\s\S]*?)<\/p>/.exec(header)?.[1] ?? ''
  const glossary =
    /<dl class="glossary">([\s\S]*?)<\/dl>/.exec(header)?.[1] ?? ''
  const decisions =
    /<h2>Decisions so far<\/h2>\s*<ul>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? ''
  return {
    intro: words(intro.replace(/<a [^>]*>[\s\S]*?<\/a>/g, '')).replace(
      /^-\s*/,
      ''
    ),
    glossary: [
      ...glossary.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)
    ].map(([, term, detail]) => ({ term: words(term), detail: words(detail) })),
    decisions: [...decisions.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(
      ([, item]) => words(item)
    )
  }
}
