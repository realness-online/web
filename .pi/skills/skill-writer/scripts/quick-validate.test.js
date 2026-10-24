import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile as write_file } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { validate_skill } from './quick-validate.js'
import { spec_check } from '../../../../bin/checks/check-skills.js'

const scratch = file_url_to_path(new URL('../../../../artifacts/skill-writer/', import.meta.url))
const script = file_url_to_path(new URL('./quick-validate.js', import.meta.url))
const execute = promisify(exec_file)
const front = (fields = 'name: sample-skill\ndescription: Use when sorting notes.', body = '# Notes') => `---\n${fields}\n---\n${body}\n`
const fixture = async (content = front(), name = 'sample-skill') => {
  await mkdir(scratch, { recursive: true })
  const parent = await mkdtemp(join(scratch, 'validator-'))
  const path = join(parent, name)
  await mkdir(path)
  if (content !== null) await write_file(join(path, 'SKILL.md'), content)
  return path
}
const put = async (path, file, content) => {
  const parts = file.split('/')
  await mkdir(join(path, ...parts.slice(0, -1)), { recursive: true })
  await write_file(join(path, file), content)
}

const integration = 'name: sample-skill\ndescription: Use when integrating a library for downstream consumers.'
const sources = status => `## Coverage matrix\n\n| Dimension | Coverage status |\n| --- | --- |\n| API surface | complete |\n| Config/runtime options | complete |\n| Common use cases | ${status} |\n| Known issues/workarounds | complete |\n| Version/migration variance | complete |\n\n## Open gaps\n\n- Collect missing usage examples.\n`
const fill_integration = async (path, status = 'complete') => {
  await put(path, 'SOURCES.md', sources(status))
  await put(path, 'references/api-surface.md', '# API')
  await put(path, 'references/common-use-cases.md', Array.from({ length: 6 }, (_, i) => `${i + 1}. Case`).join('\n'))
  await put(path, 'references/troubleshooting-workarounds.md', Array.from({ length: 8 }, () => '- Fix').join('\n'))
}

test('valid skill preserves the result contract', async () => {
  assert.deepEqual(validate_skill(await fixture()), { valid: true, skill_class: 'generic', strict_depth: false, errors: [], warnings: [] })
})

test('YAML parser handles quoted, folded, nested and list metadata', async () => {
  const path = await fixture(front('name: sample-skill\ndescription: >-\n  Use when sorting notes:\n  preserve quoted values.\nallowed-tools: [Read, Bash]\nmetadata:\n  check: "node --check script.js"\n  nested:\n    choices: [yes, no]\nlicense: MIT'))
  assert.equal(validate_skill(path).valid, true)
})

test('YAML 1.1 scalar behavior preserves boolean name rejection', async () => {
  const result = validate_skill(await fixture(front('name: yes\ndescription: Use when sorting.')))
  assert.deepEqual(result.errors, ['name must be a string, got bool'])
})

for (const [content, expected] of [
  [null, /SKILL.md not found/],
  ['# No metadata', /No YAML frontmatter/],
  ['---\nname: sample-skill', /missing closing/],
  [front('[sample-skill]'), /must be a YAML mapping/],
  [front('null'), /must be a YAML mapping/],
  [front('name: [broken'), /Invalid YAML/],
  [front('description: Use when sorting.'), /Missing required field: name/],
  [front('name: sample-skill'), /Missing required field: description/],
  [front('name: 5\ndescription: Use when sorting.'), /name must be a string, got int/],
  [front('name: sample-skill\ndescription: []'), /description must be a string, got list/],
  [front('name: sample-skill\ndescription: Use when <sorting>.'), /must not contain angle brackets/]
]) test(`rejects malformed skill: ${expected}`, async () => {
  const result = validate_skill(await fixture(content))
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), expected)
})

for (const [name, expected] of [
  ['""', /must not be empty/],
  ['A-name', /only lowercase/],
  ['-name', /start or end/],
  ['name-', /start or end/],
  ['two--names', /consecutive/],
  ['different', /does not match directory/],
  ['a'.repeat(65), /too long/]
]) test(`rejects invalid name ${name}`, async () => {
  const result = validate_skill(await fixture(front(`name: ${name}\ndescription: Use when sorting.`)))
  assert.match(result.errors.join('\n'), expected)
})

test('description, unknown fields and long bodies retain warnings', async () => {
  const path = await fixture(front('name: sample-skill\ndescription: I can sort notes.\nextra: value', Array.from({ length: 501 }, () => 'text').join('\n')))
  const result = validate_skill(path)
  assert.equal(result.valid, true)
  for (const pattern of [/Unexpected frontmatter/, /trigger phrases/, /third person/, /501 lines/]) assert.ok(result.warnings.some(warning => pattern.test(warning)))
  const long = validate_skill(await fixture(front(`name: sample-skill\ndescription: ${'x'.repeat(1025)}`)))
  assert.match(long.errors.join('\n'), /description is too long/)
})

test('directories and provenance keep their required checks', async () => {
  const path = await fixture(front(undefined, 'Read references/example.md, scripts/check.js and SOURCES.md.'))
  const missing = validate_skill(path)
  assert.equal(missing.errors.length, 3)
  await mkdir(join(path, 'references'))
  await mkdir(join(path, 'scripts'))
  await put(path, 'SOURCES.md', '# Sources')
  const result = validate_skill(path)
  assert.equal(result.valid, true)
  assert.match(result.warnings.join('\n'), /Trust tier, Confidence, Usage constraints/)
})

test('portability checks cover main and recursive references with strict severity', async () => {
  const path = await fixture(front(undefined, 'Read /Users/person/project/file.'))
  await put(path, 'references/nested/paths.md', 'Read C:\\Users\\person\\project and /home/person/project.')
  const normal = validate_skill(path)
  assert.equal(normal.valid, true)
  assert.match(normal.warnings.join('\n'), /SKILL.md/)
  assert.match(normal.warnings.join('\n'), /references\/nested\/paths.md/)
  const strict = validate_skill(path, 'generic', true)
  assert.equal(strict.valid, false)
  assert.match(strict.errors.join('\n'), /Machine-specific/)
})

for (const [description, expected] of [
  ['Use when you create a skill.', 'skill-authoring'],
  ['Use when integrating an SDK for consumers.', 'integration-documentation'],
  ['Use when doing a security audit.', 'security-review'],
  ['Use when following a CI checklist.', 'workflow-process'],
  ['Use when sorting notes.', 'generic']
]) test(`infers ${expected} without substring false positives`, async () => {
  assert.equal(validate_skill(await fixture(front(`name: sample-skill\ndescription: ${description}`))).skill_class, expected)
})

test('integration depth runs only when strict and accepts explicit class selection', async () => {
  const path = await fixture(front(integration))
  assert.equal(validate_skill(path).valid, true)
  assert.match(validate_skill(path, 'auto', true).errors.join('\n'), /should include SOURCES/)
  assert.equal(validate_skill(path, 'generic', true).valid, true)
  await fill_integration(path, 'partial')
  assert.equal(validate_skill(path, 'auto', true).valid, true)
})

test('strict integration rejects missing dimensions and nonactionable gaps', async () => {
  const path = await fixture(front(integration))
  await fill_integration(path)
  await put(path, 'SOURCES.md', '## Coverage matrix\n| Dimension | Status |\n| --- | --- |\n| API surface | partial |\n\n## Open gaps\nUnknown.\n')
  const result = validate_skill(path, 'auto', true)
  assert.match(result.errors.join('\n'), /missing required integration dimensions/)
  assert.match(result.errors.join('\n'), /lacks actionable/)
})

test('strict reference counts exclude fenced examples', async () => {
  const path = await fixture(front(integration))
  await fill_integration(path)
  await put(path, 'references/common-use-cases.md', '```md\n- Not a case\n```\n~~~\n1. Not a case\n~~~\n- One real case\n')
  assert.match(validate_skill(path, 'auto', true).errors.join('\n'), /has 1 list items; expected at least 6/)
})

test('public CLI works with no Python or uv on PATH and retains nonzero invalid exit', async () => {
  const path = await fixture()
  const { stdout } = await execute(process.execPath, [script, path], { env: { ...process.env, PATH: path } })
  assert.equal(JSON.parse(stdout).valid, true)
  const invalid = await fixture('# Invalid')
  await assert.rejects(execute(process.execPath, [script, invalid], { env: { ...process.env, PATH: path } }), error => {
    assert.equal(error.code, 1)
    assert.equal(JSON.parse(error.stdout).valid, false)
    return true
  })
  assert.equal((await spec_check(path)).valid, true)
  assert.equal((await spec_check(invalid)).valid, false)
})

test('CLI supports strict class flags, help and missing directory diagnostics', async () => {
  const path = await fixture(front(integration))
  await assert.rejects(execute(process.execPath, [script, path, '--strict-depth', '--skill-class', 'integration-documentation']), error => {
    const result = JSON.parse(error.stdout)
    assert.equal(result.strict_depth, true)
    assert.equal(result.skill_class, 'integration-documentation')
    return true
  })
  assert.match((await execute(process.execPath, [script, '--help'])).stdout, /Usage:/)
  assert.equal(validate_skill(join(path, 'absent')).valid, false)
})
