/**
 * Builds the durable browser bundle: experimental Pi code kept out of the app's
 * own bundle, so a fork merge changes it only when this build runs.
 *
 *   npm run build:durable
 *
 * The pin in `durable.lock.json` is checked before building and is never
 * rewritten by the build.
 */
import { execFileSync as exec_file_sync } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { defineConfig as define_config } from 'vite-plus'
import { frontend_out } from '#root/src/settings/output.js'
import { product_paths } from '#root/src/settings/layout.js'

/** The build runs from frontend/, so cwd is stable; the config itself is copied to a temp dir. */
const HERE = process.cwd()
const ROOT = file_url_to_path(new URL('../../../', new URL(`file://${HERE}/`)))
const FORK = `${ROOT}work/pi/packages`
const ADAPTER = `${ROOT}artifacts/durable/pi-durable-storage-idb`
const { app: app_root } = product_paths()

const lock = command =>
  exec_file_sync('node', [`${HERE}/durable-lock.js`, command], {
    encoding: 'utf8',
    stdio: 'inherit'
  })

lock('check')

/**
 * Maps each fork package specifier to its built dist, subpath and all. A bare
 * alias would prefix-match the subpath and produce a path that is not a file.
 * @param {string} specifier
 */
const pinned_path = specifier => {
  const [scope, name, ...rest] = specifier.split('/')
  const package_name = `${scope}/${name}`
  const subpath = rest.join('/')
  const base =
    package_name === '@earendil-works/pi-coding-agent'
      ? `${FORK}/coding-agent/src/core`
      : `${FORK}/${name.replace(/^pi-/, '')}/dist`
  const candidates = subpath
    ? [
        `${base}/${subpath}/index.js`,
        `${base}/${subpath}.js`,
        `${base}/${subpath}.ts`,
        `${base}/${subpath}`
      ]
    : [`${base}/index.js`]
  return candidates.find(candidate => exists_sync(candidate)) ?? null
}

const durable_resolver = () => ({
  name: 'durable-resolver',
  resolveId(source) {
    if (source === 'pi-durable-storage-idb') return `${ADAPTER}/dist/index.js`
    if (!source.startsWith('@earendil-works/')) return null
    const found = pinned_path(source)
    if (!found) throw new Error(`durable build cannot resolve ${source}`)
    return found
  }
})

export default define_config({
  resolve: {
    alias: [
      {
        find: /^pi-durable-storage-idb$/,
        replacement: `${ADAPTER}/dist/index.js`
      }
    ]
  },
  plugins: [durable_resolver()],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  build: {
    target: 'es2022',
    lib: {
      entry: `${app_root}/utils/durable-entry.js`,
      formats: ['es'],
      fileName: () => 'pi-durable.browser.js'
    },
    outDir: frontend_out(),
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
})
