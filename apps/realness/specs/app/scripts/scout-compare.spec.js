import { describe, expect, it } from 'vite-plus/test'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { item_html } from '#root/lib/items.js'
import {
  between,
  box_collect,
  box_prep,
  box_run,
  read_side
} from '#root/scripts/scout-compare.js'

const finds = values =>
  values.map(value => item_html('find', value, { links: ['url'] })).join('')

const steps = dids => dids.map(did => item_html('step', { did })).join('')

describe('scripts/scout-compare', () => {
  it('builds the box shells for one plan', () => {
    const prep = box_prep({ root: '/r', plan: 'Scouts' })
    expect(prep).toContain(
      'cp -r /realness/vault/Projects/Scouts /r/vault/Projects/'
    )
    expect(prep).toContain('rm -rf /r/vault/Projects/Scouts/Runs')
    expect(prep).toContain('ln -s /apps /r/apps')
    expect(prep).toContain('vault|artifacts|apps|')
    const run = box_run({
      root: '/r',
      plan: 'Scouts',
      source: 'vuejobs',
      model: 'realness/standard',
      person: '/+1'
    })
    expect(run).toContain('REALNESS_PERSON=/+1')
    expect(run).toContain('--source vuejobs --run --model realness/standard')
    expect(box_collect({ root: '/r', plan: 'Scouts' })).toContain(
      'cd /r/vault/Projects/Scouts/Runs'
    )
  })

  it('reads the text between two markers', () => {
    expect(between('a <<<X hi >>>X b', '<<<X', '>>>X')).toBe('hi')
    expect(between('nothing here', '<<<X', '>>>X')).toBe('')
  })

  it('counts leads and reads on a side that found something', () => {
    const side = read_side({
      html: finds([{ url: 'https://a.com/1', score: 8, reason: 'fits' }]),
      steps: steps(['realness-read https://a.com', 'ls']),
      model: 'm',
      seconds: 3
    })
    expect(side).toMatchObject({ model: 'm', leads: 1, reads: 1, seconds: 3 })
    expect(side.failed).toBeUndefined()
  })

  it('names why a side found nothing', () => {
    const read = (html, output) =>
      read_side({ html, model: 'm', seconds: 1, output }).failed
    expect(read(finds([{ score: 2 }]))).toBe('no url')
    expect(read('', 'scout failed: no model')).toBe('no model')
    expect(read('<p>x</p>')).toBe('the run wrote an empty page')
    expect(read(undefined)).toBe('wrote no finds')
  })

  it('counts a side that found no one, and says why, as a run', () => {
    const side = read_side({
      html: '<article><p>No one on these feeds asked for a poster or a print.</p></article>',
      model: 'm',
      seconds: 1
    })
    expect(side.leads).toBe(0)
    expect(side.failed).toBeUndefined()
  })

  it('reads the newest run from a plan folder, or fails when none landed', () => {
    const plan_dir = mkdtemp_sync(
      join(process.env.TMPDIR ?? '.', 'scout-compare-')
    )
    const run_dir = join(plan_dir, 'Runs', '2026-01-02')
    mkdir_sync(run_dir, { recursive: true })
    write_file_sync(
      join(run_dir, 'finds.html'),
      finds([{ url: 'https://a.com/1', score: 8, reason: 'fits' }])
    )
    write_file_sync(join(run_dir, 'steps.html'), steps([]))
    expect(read_side({ plan_dir, model: 'm', seconds: 1 }).leads).toBe(1)
    const empty = mkdtemp_sync(
      join(process.env.TMPDIR ?? '.', 'scout-compare-')
    )
    expect(read_side({ plan_dir: empty, model: 'm', seconds: 1 }).failed).toBe(
      'wrote no finds'
    )
  })
})
