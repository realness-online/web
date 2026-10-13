import { defineConfig as define_config } from 'vite-plus'
import { fileURLToPath as file_url_to_path } from 'node:url'
import {
  copyFileSync as copy_file_sync,
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import path from 'node:path'
import { out_path } from '../lib/output.js'
import { product_paths } from '#root/src/settings/layout.js'

const project_root = file_url_to_path(new URL('.', import.meta.url))
const { app: app_root } = product_paths()
const valid_worker_names = ['vector', 'compressor', 'tracer']
const worker_name = process.env.WORKER_NAME

if (!worker_name) throw new Error('WORKER_NAME is required')
if (!valid_worker_names.includes(worker_name))
  throw new Error(`Invalid WORKER_NAME: ${worker_name}`)

const sync_tracer_wasm = () => {
  const tracer_source_path = out_path('wasm', 'tracer.js')
  const tracer_output_path = path.join(app_root, 'wasm/tracer.js')
  const wasm_source_path = out_path('wasm', 'tracer_bg.wasm')
  const wasm_output_path = path.resolve(
    project_root,
    'public/wasm/tracer_bg.wasm'
  )

  if (!exists_sync(tracer_source_path)) return
  if (!exists_sync(wasm_source_path)) return

  const tracer_source = read_file_sync(tracer_source_path, 'utf8')
  const tracer_source_without_import_meta = tracer_source.replace(
    "module_or_path = new URL('tracer_bg.wasm', import.meta.url);",
    "module_or_path = '/wasm/tracer_bg.wasm';"
  )
  const ts_nocheck_header = '// @ts-nocheck\n'
  const tracer_output = tracer_source_without_import_meta.startsWith(
    ts_nocheck_header
  )
    ? tracer_source_without_import_meta
    : `${ts_nocheck_header}${tracer_source_without_import_meta}`

  mkdir_sync(path.dirname(tracer_output_path), { recursive: true })
  mkdir_sync(path.dirname(wasm_output_path), { recursive: true })
  write_file_sync(tracer_output_path, tracer_output)
  copy_file_sync(wasm_source_path, wasm_output_path)
}

const tracer_wasm_plugin = {
  name: 'tracer-wasm-sync',
  buildStart() {
    if (worker_name !== 'tracer') return
    sync_tracer_wasm()
  },
  writeBundle() {
    if (worker_name !== 'tracer') return
    sync_tracer_wasm()
  }
}

export default define_config({
  publicDir: false,
  resolve: {
    alias: {
      '@': app_root
    },
    extensions: ['.js', '.json', '.vue']
  },
  plugins: [tracer_wasm_plugin],
  build: {
    outDir: 'public',
    emptyOutDir: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: path.join(app_root, `workers/${worker_name}.js`),
      output: {
        format: 'iife',
        name: 'worker',
        entryFileNames: `${worker_name}.worker.js`
      }
    }
  }
})
