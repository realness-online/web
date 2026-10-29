import assert from 'node:assert/strict'
import { readFileSync as read_file } from 'node:fs'
import { it } from 'node:test'
import {
  PWA_COLOR,
  pwa_manifest,
  pwa_plugin,
  pwa_workbox
} from '#root/src/settings/pwa.js'

const builds = ['vite.config.js', 'tools/publish/renderer/src/pwa.js']

it('pw5: prompt mode and page claiming are the shared default', () => {
  assert.equal(pwa_plugin.registerType, 'prompt')
  assert.equal(pwa_plugin.filename, 'service.worker.js')
  assert.equal(pwa_workbox.clientsClaim, true)
})

it('pw5: a manifest carries installable traits and versioned icons', () => {
  const manifest = pwa_manifest({
    name: 'Site',
    description: 'A site',
    icon_version: '3.0.0'
  })
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.theme_color, PWA_COLOR)
  assert.deepEqual(
    manifest.icons.map(icon => [icon.src, icon.purpose]),
    [
      ['/192.png?v=3.0.0', 'any maskable'],
      ['/512.png?v=3.0.0', 'any maskable']
    ]
  )
  assert.equal(
    pwa_manifest({ name: 'S', description: '' }).icons[0].src,
    '/192.png'
  )
})

for (const build of builds)
  it(`pw5: ${build} builds from the shared settings`, () => {
    const text = read_file(new URL(`../../${build}`, import.meta.url), 'utf8')
    for (const name of ['...pwa_plugin', '...pwa_workbox', 'pwa_manifest('])
      assert.ok(text.includes(name), `${build} does not use ${name}`)
    assert.doesNotMatch(text, /registerType:|clientsClaim:|theme_color:/)
  })
