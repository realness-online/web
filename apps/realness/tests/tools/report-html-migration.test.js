/**
 * The migration report CLI's argument gate. `main` needs firebase-admin and a
 * live bucket, so what is checked here is the part that decides whether it may
 * run at all: explicit targets, and an --apply that cannot point at another
 * project's bucket.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { report_options } from '../../tools/ops/report-html-migration.js'

const usage = /Usage: npm run migration:report/

test('report_options reads the two explicit targets and reports by default', () => {
  assert.deepEqual(
    report_options(['--project', 'realness-development', '--bucket', 'b']),
    { project: 'realness-development', bucket_name: 'b', apply: false }
  )
})

test("report_options accepts --apply on the project's own appspot bucket", () => {
  assert.deepEqual(
    report_options([
      '--project',
      'realness-development',
      '--bucket',
      'realness-development.appspot.com',
      '--apply'
    ]),
    {
      project: 'realness-development',
      bucket_name: 'realness-development.appspot.com',
      apply: true
    }
  )
})

test("--apply refuses any bucket but the project's own", () => {
  assert.throws(
    () =>
      report_options([
        '--project',
        'realness-development',
        '--bucket',
        'someone-else.appspot.com',
        '--apply'
      ]),
    /--apply only writes the project's own appspot bucket/
  )
})

test('both targets are required, and a bare run says how to use it', () => {
  assert.throws(() => report_options([]), usage)
  assert.throws(
    () => report_options(['--project', 'p']),
    /Both --project and --bucket are required/
  )
  assert.throws(
    () => report_options(['--bucket', 'b']),
    /Both --project and --bucket are required/
  )
})

test('an unknown option or a missing value is a usage error', () => {
  assert.throws(() => report_options(['--nope', 'x']), usage)
  assert.throws(() => report_options(['--project', '--bucket']), usage)
  assert.throws(() => report_options(['--project']), usage)
  assert.throws(() => report_options(['--bucket']), usage)
})

test('a repeated option is named rather than silently overwritten', () => {
  assert.throws(
    () => report_options(['--project', 'a', '--project', 'b']),
    /Repeated option: --project/
  )
  assert.throws(
    () => report_options(['--apply', '--apply']),
    /Repeated option: --apply/
  )
})
