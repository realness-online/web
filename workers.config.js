import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import alias from '@rollup/plugin-alias'
import analyzer from 'rollup-plugin-analyzer'
import path from 'path'
import { fileURLToPath } from 'url'
import copy from 'rollup-plugin-copy'

const MIN_SIZE_BYTES = 1000
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const create_worker_config = filename => ({
  input: `src/workers/${filename}.js`,
  output: {
    file: `public/${filename}.worker.js`,
    format: 'iife',
    name: 'worker'
  },
  plugins: [
    alias({
      entries: [
        {
          find: '@',
          replacement: path.resolve(__dirname, './src')
        }
      ]
    }),
    resolve({
      browser: true
    }),
    commonjs(),
    ...(filename === 'tracer'
      ? [
          copy({
            targets: [
              {
                src: 'artifacts/wasm/tracer_bg.wasm',
                dest: 'public/wasm'
              },
              {
                src: 'artifacts/wasm/tracer.js',
                dest: 'src/wasm'
              }
            ],
            hook: 'writeBundle'
          })
        ]
      : []),
    analyzer({
      summaryOnly: true,
      limit: 10,
      filter: ({ size }) => size > MIN_SIZE_BYTES
    })
  ],
  watch: {
    exclude: ['public/wasm/**', 'src/wasm/**']
  }
})

export default [
  create_worker_config('vector'),
  create_worker_config('compressor'),
  create_worker_config('tracer'),
  create_worker_config('video-frame')
]
