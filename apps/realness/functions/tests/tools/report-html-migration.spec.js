import { describe, it, expect } from 'vitest'
import { report_options } from '../../../tools/ops/report-html-migration.js'

describe('migration report options', () => {
  it('reports by default with explicit project and bucket', () => {
    expect(report_options(['--project', 'development', '--bucket', 'dev-bucket'])).toEqual({
      project: 'development', bucket_name: 'dev-bucket', apply: false
    })
  })

  it('applies only to the project\'s own bucket', () => {
    expect(report_options([
      '--apply', '--project', 'realness-online', '--bucket', 'realness-online.appspot.com'
    ])).toMatchObject({ apply: true })
    expect(() => report_options([
      '--project', 'realness-online', '--bucket', 'other.appspot.com', '--apply'
    ])).toThrow('own appspot bucket')
  })

  it.each([
    [], ['--project', 'production'], ['--bucket', 'bucket'],
    ['--project', '--bucket'], ['--write'],
    ['--project', 'p', '--bucket', 'b', '--project', 'other'],
    ['--apply', '--apply', '--project', 'p', '--bucket', 'p.appspot.com']
  ])('rejects incomplete, repeated, or unknown arguments: %j', args => {
    expect(() => report_options(args)).toThrow()
  })
})
