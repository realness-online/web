/**
 * v3f: the map pages read their own tables out of the vault's scripts.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  map_prose,
  modules_data,
  ways_in_data
} from '#root/src/sync/vault-maps.js'

const MODULES = `import { restore } from "./url-state.js";
const concerns = ["identity", "storage"];
const avatars = { scott: "Scott" };
const all_people = ["scott", "odessa"];
const fates = { keep: "Keep it" };
const modules = [
  {
    section: "Product source",
    id: "settings",
    name: "settings",
    owns: "Paths, with a ] and a } in the words",
    concerns: ["storage"],
    avatars: [...all_people],
    notes: ["One note; still one"]
  }
];
const patterns = ["One product"];
const questions = ["One status file?"];
document.querySelector("#body").innerHTML = "drawn";
const sections = [...new Set(modules.map((m) => m.section))];`

const WAYS_IN = `const columns = [["identity", "Identity"]];
const avatars = [{ id: "scott", name: "Scott", needs: ["Sync"] }];
const orgs = ["Brayness"];
const rows = [
  { section: "Solo", id: "solo-terminal", identity: ["none", "None"], avatars: ["scott"] }
];
const patterns = ["One product"];
const questions = ["Roles?"];
const statuses = ["works", "gap"];
document.querySelector("#body").innerHTML = "drawn";`

it('reads the modules data, including a list spread from another constant', () => {
  const data = modules_data(MODULES)
  assert.deepEqual(data.concerns, ['identity', 'storage'])
  assert.deepEqual(data.avatars, { scott: 'Scott' })
  assert.deepEqual(data.fates, { keep: 'Keep it' })
  assert.equal(data.modules.length, 1)
  assert.deepEqual(data.modules[0].avatars, ['scott', 'odessa'])
  assert.equal(data.modules[0].owns, 'Paths, with a ] and a } in the words')
  assert.deepEqual(data.patterns, ['One product'])
  assert.deepEqual(data.questions, ['One status file?'])
})

it('reads the ways in data, and leaves the drawing to the app', () => {
  const data = ways_in_data(WAYS_IN)
  assert.deepEqual(data.columns, [['identity', 'Identity']])
  assert.deepEqual(data.avatars, [
    { id: 'scott', name: 'Scott', needs: ['Sync'] }
  ])
  assert.deepEqual(data.rows, [
    {
      section: 'Solo',
      id: 'solo-terminal',
      identity: ['none', 'None'],
      avatars: ['scott']
    }
  ])
  assert.deepEqual(data.statuses, ['works', 'gap'])
  assert.deepEqual(data.questions, ['Roles?'])
})

it('reads empty when a page holds no such data', () => {
  const data = modules_data('const nothing = 1;')
  assert.deepEqual(data.modules, [])
  assert.deepEqual(data.patterns, [])
})

const PROSE = `<body><header><h1>Modules</h1>
<p><a href="/blog/realness/">Realness plan</a> - One product: source &amp; app.
<a href="/maps/ways-in.html">Ways in</a></p>
<details class="glossary-box"><summary>Glossary</summary>
<dl class="glossary"><dt>Module</dt><dd>A folder with one job.</dd>
<dt>Root import</dt><dd>Internal files use <code>#root/</code>.</dd></dl></details>
</header><table></table>
<section class="notes"><details class="more"><summary>More</summary>
<h2>Decisions so far</h2><ul><li>Folders separate jobs.</li>
<li>Imports use <code>#root/</code>.</li></ul>
<h2>Patterns</h2><ul id="patterns"></ul></details></section></body>`

it('reads the page prose: intro, glossary, and decisions', () => {
  assert.deepEqual(map_prose(PROSE), {
    intro: 'One product: source & app.',
    glossary: [
      { term: 'Module', detail: 'A folder with one job.' },
      { term: 'Root import', detail: 'Internal files use #root/.' }
    ],
    decisions: ['Folders separate jobs.', 'Imports use #root/.']
  })
})
