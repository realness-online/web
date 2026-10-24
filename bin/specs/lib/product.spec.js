import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  writeFileSync as write_file_sync,
  rmSync as rm_sync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { plans_ignore, plans_path } from '../../lib/harness-settings.js'
import { product_entry, product_import, product_manifest } from '../../lib/product.js'
import { pathToFileURL as path_to_file_url } from 'node:url'

it('harness settings are the product functions, not copied implementations', async () => {
  const settings = await product_import('harness/settings')
  assert.equal(typeof settings.plans_ignore, 'function')
  assert.equal(plans_path, settings.plans_path)
  assert.equal(plans_ignore, settings.plans_ignore)
})

const scratch = resolve(
  import.meta.dirname,
  '../../../artifacts/realness/product-path-tests'
)

for (const package_name of ['realness', 'test-product']) {
  for (const layout of ['apps/realness']) {
    it(`${package_name} exports resolve from ${layout} without dependencies`, () => {
      mkdir_sync(scratch, { recursive: true })
      const root = mkdtemp_sync(join(scratch, 'case-'))
      const folder = join(root, layout)
      try {
        mkdir_sync(folder, { recursive: true })
        write_file_sync(
          join(folder, 'package.json'),
          JSON.stringify({
            name: package_name,
            type: 'module',
            exports: { './command': './command.js' }
          })
        )
        write_file_sync(
          join(folder, 'command.js'),
          'export const ready = true\n'
        )
        assert.equal(product_entry('command', root), join(folder, 'command.js'))
      } finally {
        rm_sync(root, { recursive: true, force: true })
      }
    })
  }
}

it('product export changes resolve without restarting the process', () => {
  mkdir_sync(scratch, { recursive: true })
  const root = mkdtemp_sync(join(scratch, 'reload-'))
  const folder = join(root, 'apps/realness')
  try {
    mkdir_sync(folder, { recursive: true })
    const manifest = join(folder, 'package.json')
    const save = entry => write_file_sync(manifest, JSON.stringify({
      name: 'realness',
      type: 'module',
      exports: { './command': { node: `./${entry}.js` } }
    }))
    for (const entry of ['first', 'second'])
      write_file_sync(join(folder, `${entry}.js`), 'export const ready = true\n')
    save('first')
    assert.equal(product_entry('command', root), join(folder, 'first.js'))
    save('second')
    assert.equal(product_entry('command', root), join(folder, 'second.js'))
  } finally {
    rm_sync(root, { recursive: true, force: true })
  }
})

it('product lookup ignores the removed environment override', context => {
  const previous = process.env.REALNESS_PRODUCT
  context.after(() => {
    if (previous === undefined) delete process.env.REALNESS_PRODUCT
    else process.env.REALNESS_PRODUCT = previous
  })
  const expected = product_manifest()
  process.env.REALNESS_PRODUCT = '/ignored/package.json'
  assert.equal(product_manifest(), expected)
})

it('the harness resolves commands through the public product export', async () => {
  const manifest = await import(path_to_file_url(product_manifest()), {
    with: { type: 'json' }
  })
  assert.ok(
    product_entry('command').endsWith(
      manifest.default.exports['./command'].node.slice(1)
    )
  )
  assert.throws(() => product_entry('private-source'), {
    code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
  })
})
