import { defineConfig } from 'vite-plus'
import { fileURLToPath } from 'node:url'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'

const project_root = fileURLToPath(new URL('.', import.meta.url))
const valid_worker_names = ['vector', 'compressor', 'tracer']
const worker_name = process.env.WORKER_NAME

if (!worker_name) throw new Error('WORKER_NAME is required')
if (!valid_worker_names.includes(worker_name))
  throw new Error(`Invalid WORKER_NAME: ${worker_name}`)

const sync_tracer_wasm = () => {
  const tracer_source_path = path.resolve(
    project_root,
    'artifacts/wasm/tracer.js'
  )
  const tracer_output_path = path.resolve(project_root, 'src/wasm/tracer.js')
  const wasm_source_path = path.resolve(
    project_root,
    'artifacts/wasm/tracer_bg.wasm'
  )
  const wasm_output_path = path.resolve(
    project_root,
    'public/wasm/tracer_bg.wasm'
  )

  if (!existsSync(tracer_source_path)) return
  if (!existsSync(wasm_source_path)) return

  const tracer_source = readFileSync(tracer_source_path, 'utf8')
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

  mkdirSync(path.dirname(tracer_output_path), { recursive: true })
  mkdirSync(path.dirname(wasm_output_path), { recursive: true })
  writeFileSync(tracer_output_path, tracer_output)
  copyFileSync(wasm_source_path, wasm_output_path)
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

export default defineConfig({
  publicDir: false,
  resolve: {
    alias: {
      '@': path.resolve(project_root, './src')
    },
    extensions: ['.js', '.json', '.vue']
  },
  plugins: [tracer_wasm_plugin],
  build: {
    outDir: 'public',
    emptyOutDir: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: path.resolve(project_root, `src/workers/${worker_name}.js`),
      output: {
        format: 'iife',
        name: 'worker',
        entryFileNames: `${worker_name}.worker.js`
      }
    }
  }
})
