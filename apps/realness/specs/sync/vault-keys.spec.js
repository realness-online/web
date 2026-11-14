/**
 * v3d: the key layout page reads its tables from the vault's own script.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { key_layouts, key_page } from '#root/src/sync/vault-keys.js'

const SOURCE = `/** The selected layout. */
const rows = ['\`1234567890', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./']

const pi_reserved = new Set(['b', 'd', 'f', 'y'])
const pi_windows = new Set(['p', 'q', 'v', 'z'])

const today = {
  1: ['go', 'Thoughts'],
  w: ['view', 'Story\\u00ADtelling'],
  ',': ['app', 'Settings']
}

export const layouts = {
  leader: {
    ...today,
    '\`': ['chat', 'Chat in/out'],
    2: ['go', 'Chat']
  },
  terminal_ctrl: {
    a: ['terminal', 'Line start']
  },
  leader_direct: {
    ' ': ['app', 'Open keys panel']
  }
}

const panel_on = new Set(['a', 's'])`

it('reads the bare key rows', () => {
  assert.deepEqual(key_layouts(SOURCE).rows, [
    '`1234567890',
    'qwertyuiop[]',
    "asdfghjkl;'",
    'zxcvbnm,./'
  ])
})

it('reads each map, and folds the bare map into the leader map', () => {
  const { layouts } = key_layouts(SOURCE)
  assert.deepEqual(layouts.leader.w, ['view', 'Story\u00ADtelling'])
  assert.deepEqual(layouts.leader[','], ['app', 'Settings'])
  assert.deepEqual(layouts.leader[2], ['go', 'Chat'])
  assert.deepEqual(layouts.terminal_ctrl.a, ['terminal', 'Line start'])
  assert.deepEqual(layouts.leader_direct[' '], ['app', 'Open keys panel'])
  assert.equal(layouts.leader_direct.w, undefined)
})

it('reads the panel keys and both reserved sets', () => {
  const keys = key_layouts(SOURCE)
  assert.deepEqual(keys.panel_on, ['a', 's'])
  assert.deepEqual(keys.pi_reserved, ['b', 'd', 'f', 'y'])
  assert.deepEqual(keys.pi_windows, ['p', 'q', 'v', 'z'])
})
const PAGE = `<html><body><main>
  <header>
    <h1 itemprop="name">Key layouts</h1>
    <p itemprop="description">The selected leader layout.</p>
    <ul aria-label="Legend">
      <li data-group="layers">Values and layers</li>
      <li data-reserved="pi">Pi uses Alt+key</li>
    </ul>
    <p>Direct shortcuts first.</p>
  </header>
  <section id="leader" itemprop="hasPart">
    <h2 itemprop="name">One leader key</h2>
    <figure data-map="leader_direct"><figcaption>Option+Space opens the panel.</figcaption></figure>
    <figure data-map="leader" data-panel><figcaption>Bare keys work.</figcaption></figure>
    <dl><dt>Keeps</dt><dd>Poster settings keep their positions.</dd></dl>
  </section>
</main></body></html>`

it('reads the page prose, legend, and figures', () => {
  const page = key_page(PAGE)
  assert.equal(page.title, 'Key layouts')
  assert.equal(page.description, 'The selected leader layout.')
  assert.deepEqual(page.legend, [
    { label: 'Values and layers', group: 'layers' },
    { label: 'Pi uses Alt+key', reserved: 'pi' }
  ])
  assert.deepEqual(page.notes, ['Direct shortcuts first.'])
  assert.deepEqual(page.sections, [
    {
      id: 'leader',
      title: 'One leader key',
      figures: [
        {
          map: 'leader_direct',
          panel: false,
          caption: 'Option+Space opens the panel.'
        },
        { map: 'leader', panel: true, caption: 'Bare keys work.' }
      ],
      terms: [
        { term: 'Keeps', detail: 'Poster settings keep their positions.' }
      ]
    }
  ])
})
