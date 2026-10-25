import { existsSync as exists_sync, readFileSync as read_file, readdirSync as readdir, statSync as stat } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { parseArgs as parse_args } from 'node:util'
import { parseDocument as parse_document } from 'yaml'

const max_name_length = 64
const max_description_length = 1024
const max_skill_lines = 500
const skill_classes = [
  'auto',
  'workflow-process',
  'integration-documentation',
  'security-review',
  'skill-authoring',
  'generic'
]
const allowed_fields = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
  'argument-hint',
  'disable-model-invocation',
  'user-invocable',
  'model',
  'context',
  'agent',
  'hooks'
])
const required_dimensions = [
  ['API surface', ['api surface', 'api contract', 'public api']],
  ['Config/runtime options', ['config', 'runtime option', 'configuration', 'option']],
  ['Common use cases', ['common use', 'usage pattern', 'normal usage', 'use case']],
  ['Known issues/workarounds', ['known issue', 'failure mode', 'troubleshooting', 'workaround']],
  ['Version/migration variance', ['version', 'migration', 'deprecation', 'variance']]
]
const required_references = [
  ['references/api-surface.md', null],
  ['references/common-use-cases.md', 6],
  ['references/troubleshooting-workarounds.md', 8]
]
const partial_tokens = ['partial', 'missing', 'incomplete', 'todo', 'unknown']
const action_tokens = [
  'add',
  'collect',
  'document',
  'retrieve',
  'validate',
  'test',
  'confirm',
  'expand',
  'review',
  'map'
]
const trigger_tokens = [
  'use when',
  'use for',
  'use to',
  'use on',
  'use before',
  'use after',
  'when the user',
  'when asked',
  'trigger',
  'invoke'
]
const machine_paths = [
  /\/Users\/[^/\s`"'<>)](?:[^\s`"'<>)]*)/g,
  /\/home\/[^/\s`"'<>)](?:[^\s`"'<>)]*)/g,
  /\/var\/folders\/[^/\s`"'<>)](?:[^\s`"'<>)]*)/g,
  /\/private\/var\/folders\/[^/\s`"'<>)](?:[^\s`"'<>)]*)/g,
  /[A-Za-z]:\\Users\\[^\s`"'<>)](?:[^\s`"'<>)]*)/g
]

const has_any_term = (text, terms) =>
  terms.some(term =>
    term.includes(' ')
      ? text.includes(term)
      : new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)
  )

const infer_skill_class = (description, content) => {
  const text = `${description}\n${content}`.toLowerCase()
  if (has_any_term(text, ['create a skill', 'write a skill', 'skill-writer', 'maintain skill docs']))
    return 'skill-authoring'
  if (
    has_any_term(text, ['integrate', 'sdk', 'library', 'api surface', 'public api', 'api contract']) &&
    has_any_term(text, ['use when', 'downstream', 'consumer', 'abstraction'])
  )
    return 'integration-documentation'
  if (
    has_any_term(text, ['vulnerability', 'owasp', 'injection', 'xss', 'idor']) ||
    (has_any_term(text, ['security']) && has_any_term(text, ['review', 'audit', 'scan']))
  )
    return 'security-review'
  if (has_any_term(text, ['workflow', 'ci', 'branch', 'checklist', 'runbook', 'triage'])) return 'workflow-process'
  return 'generic'
}

const section_lines = (markdown, heading) => {
  const lines = markdown.split(/\r?\n/)
  const at = lines.findIndex(line => line.trim().startsWith('## ') && line.toLowerCase().includes(heading))
  if (at < 0) return []
  const rest = lines.slice(at + 1)
  const end = rest.findIndex(line => line.trim().startsWith('## '))
  return end < 0 ? rest : rest.slice(0, end)
}

const coverage_rows = markdown =>
  section_lines(markdown, 'coverage matrix').flatMap(line => {
    const text = line.trim()
    if (!text.startsWith('|') || /^\|\s*-+\s*\|/.test(text)) return []
    const columns = text
      .replace(/^\|+|\|+$/g, '')
      .split('|')
      .map(column => column.trim().toLowerCase())
    if (columns.length < 2 || ['dimension', 'coverage status'].includes(columns[0])) return []
    return [[columns[0], columns[1]]]
  })

const count_list_items = markdown => {
  let count = 0
  let fenced = false
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    else if (!fenced && /^\s*(?:-|\d+\.)\s+/.test(line)) count += 1
  }
  return count
}

const markdown_files = directory =>
  readdir(directory, { withFileTypes: true })
    .flatMap(entry => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return markdown_files(path)
      return entry.name.endsWith('.md') ? [path] : []
    })
    .sort()

const find_machine_paths = text => [
  ...new Set(machine_paths.flatMap(pattern => [...text.matchAll(pattern)].map(match => match[0])))
]

const validate_portable_paths = (path, content, severity) => {
  const hits = []
  const main_hits = find_machine_paths(content)
  if (main_hits.length) hits.push(`SKILL.md: ${main_hits.slice(0, 3).join(', ')}`)
  const refs = join(path, 'references')
  if (exists_sync(refs))
    for (const file of markdown_files(refs)) {
      const found = find_machine_paths(read_file(file, 'utf8'))
      if (found.length) hits.push(`${relative(path, file)}: ${found.slice(0, 3).join(', ')}`)
    }
  if (hits.length)
    severity.push(
      'Machine-specific absolute filesystem paths detected. Use portable placeholders like `<repo-root>/...` or `<skill-dir>/...`. Offenders: ' +
        hits.join('; ')
    )
}

const validate_integration_depth = (path, severity) => {
  const sources = join(path, 'SOURCES.md')
  if (!exists_sync(sources)) {
    severity.push(
      'Integration/documentation skill should include SOURCES.md with a coverage matrix and open gaps section'
    )
    return
  }
  const content = read_file(sources, 'utf8')
  const rows = coverage_rows(content)
  if (!rows.length) severity.push('SOURCES.md is missing a parseable `## Coverage matrix` table')
  else {
    const missing = required_dimensions
      .filter(([, tokens]) => !rows.some(([dimension]) => tokens.some(token => dimension.includes(token))))
      .map(([label]) => label)
    if (missing.length)
      severity.push('Coverage matrix is missing required integration dimensions: ' + missing.join(', '))
    const partial = rows.some(([, status]) => partial_tokens.some(token => status.includes(token)))
    const actionable = section_lines(content, 'open gaps').some(line => {
      const text = line.trim().toLowerCase()
      return (text.startsWith('-') || /^\d+\./.test(text)) && action_tokens.some(token => text.includes(token))
    })
    if (partial && !actionable)
      severity.push(
        'Coverage matrix has partial/missing dimensions but `## Open gaps` lacks actionable next retrieval steps'
      )
  }
  for (const [file, minimum] of required_references) {
    const target = join(path, file)
    if (!exists_sync(target)) severity.push(`Missing required reference for integration/documentation skill: ${file}`)
    else if (minimum !== null) {
      const count = count_list_items(read_file(target, 'utf8'))
      if (count < minimum)
        severity.push(`${file} has ${count} list items; expected at least ${minimum} for sufficient depth`)
    }
  }
}

const type_name = value => {
  if (value === null) return 'NoneType'
  if (Array.isArray(value)) return 'list'
  if (typeof value === 'boolean') return 'bool'
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float'
  return typeof value === 'object' ? 'dict' : typeof value
}

const validate_name = (name, path, errors) => {
  if (typeof name !== 'string') return errors.push(`name must be a string, got ${type_name(name)}`)
  const clean = name.trim()
  const length = [...clean].length
  if (!clean) errors.push('name must not be empty')
  else if (length > max_name_length) errors.push(`name is too long (${length} chars, max ${max_name_length})`)
  else if (!/^[a-z0-9-]+$/.test(clean))
    errors.push(`name '${clean}' must contain only lowercase letters, digits, and hyphens`)
  else if (clean.startsWith('-') || clean.endsWith('-'))
    errors.push(`name '${clean}' must not start or end with a hyphen`)
  else if (clean.includes('--')) errors.push(`name '${clean}' must not contain consecutive hyphens`)
  else if (clean !== basename(path)) errors.push(`name '${clean}' does not match directory name '${basename(path)}'`)
}

const validate_description = (description, errors, warnings) => {
  if (typeof description !== 'string') {
    errors.push(`description must be a string, got ${type_name(description)}`)
    return ''
  }
  const clean = description.trim()
  const length = [...clean].length
  if (!clean) errors.push('description must not be empty')
  else if (length > max_description_length)
    errors.push(`description is too long (${length} chars, max ${max_description_length})`)
  if (/[<>]/.test(clean)) errors.push('description must not contain angle brackets (< or >)')
  const lower = clean.toLowerCase()
  if (!trigger_tokens.some(token => lower.includes(token)))
    warnings.push('description should include trigger phrases (e.g., \'Use when asked to "review code"\')')
  if (['i ', 'i can', 'you '].some(prefix => lower.startsWith(prefix)))
    warnings.push('description should be in third person ("Processes files..." not "I can process files...")')
  return clean
}

export const validate_skill = (directory, selected_skill_class = 'auto', strict_depth = false) => {
  const path = resolve(directory)
  const errors = []
  const warnings = []
  const result = skill_class => ({ valid: errors.length === 0, skill_class, strict_depth, errors, warnings })
  const fail = message => {
    errors.push(message)
    return result('generic')
  }
  if (!exists_sync(path) || !stat(path).isDirectory()) return fail(`Not a directory: ${path}`)
  if (!skill_classes.includes(selected_skill_class)) return fail(`Unknown skill class: ${selected_skill_class}`)
  const main = join(path, 'SKILL.md')
  if (!exists_sync(main)) return fail('SKILL.md not found')
  const content = read_file(main, 'utf8')
  if (!content.startsWith('---')) return fail('No YAML frontmatter found (file must start with ---)')
  const front = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!front) return fail('Invalid frontmatter format (missing closing ---)')
  let metadata
  try {
    const document = parse_document(front[1], { version: '1.1', uniqueKeys: false })
    if (document.errors.length) throw document.errors[0]
    metadata = document.toJS()
  } catch (error) {
    return fail(`Invalid YAML in frontmatter: ${error.message}`)
  }
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata))
    return fail('Frontmatter must be a YAML mapping')
  const unexpected = Object.keys(metadata)
    .filter(field => !allowed_fields.has(field))
    .sort()
  if (unexpected.length)
    warnings.push(`Unexpected frontmatter field(s): ${unexpected.join(', ')}. These may be ignored by some tools.`)
  if (!Object.hasOwn(metadata, 'name')) errors.push('Missing required field: name')
  else validate_name(metadata.name, path, errors)
  let description = ''
  if (!Object.hasOwn(metadata, 'description')) errors.push('Missing required field: description')
  else description = validate_description(metadata.description, errors, warnings)
  const body = content.slice(content.indexOf('---', 3) + 3).trim()
  const body_lines = body ? body.split(/\r?\n/).length : 0
  if (body_lines > max_skill_lines)
    warnings.push(
      `SKILL.md body is ${body_lines} lines (recommended max ${max_skill_lines}). Consider moving content to references/.`
    )
  for (const name of ['references', 'scripts'])
    if (new RegExp(`(?<![\\w./-])(?:\\./)?${name}/[\\w.-]+`).test(content) && !exists_sync(join(path, name)))
      errors.push(`SKILL.md references '${name}/' but directory does not exist`)
  if (content.includes('SOURCES.md')) {
    const sources = join(path, 'SOURCES.md')
    if (!exists_sync(sources)) errors.push("SKILL.md references 'SOURCES.md' but file does not exist")
    else {
      const text = read_file(sources, 'utf8')
      const missing = ['Trust tier', 'Confidence', 'Usage constraints'].filter(header => !text.includes(header))
      if (missing.length) warnings.push('SOURCES.md is missing expected provenance columns: ' + missing.join(', '))
    }
  }
  if (/(?:plugins|skills)\/[a-z-]+\/(?:scripts|references|assets)\//.test(content))
    warnings.push(
      'SKILL.md may contain hardcoded paths. Use skill-local references/... paths and run scripts via <skill-dir>/scripts/...'
    )
  const resolved = selected_skill_class === 'auto' ? infer_skill_class(description, body) : selected_skill_class
  if (resolved === 'integration-documentation' && strict_depth) validate_integration_depth(path, errors)
  validate_portable_paths(path, content, strict_depth ? errors : warnings)
  return result(resolved)
}

const main = () => {
  const { values, positionals } = parse_args({
    allowPositionals: true,
    options: {
      'skill-class': { type: 'string', default: 'auto' },
      'strict-depth': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' }
    }
  })
  if (values.help) {
    process.stdout.write('Usage: node quick-validate.js <skill_directory> [--skill-class <class>] [--strict-depth]\n')
    return
  }
  if (positionals.length !== 1 || !skill_classes.includes(values['skill-class']))
    throw new Error('Expected one skill directory and a known --skill-class')
  const result = validate_skill(positionals[0], values['skill-class'], values['strict-depth'])
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.valid ? 0 : 1
}

if (process.argv[1] && resolve(process.argv[1]) === file_url_to_path(import.meta.url)) main()
