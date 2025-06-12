import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import alias from '@rollup/plugin-alias'
import analyzer from 'rollup-plugin-analyzer'
import path from 'path'
import { fileURLToPath } from 'url'
import copy from 'rollup-plugin-copy'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const create_worker_config = filename => ({
  input: `src/workers/${filename}.js`,
  output: {
    file: `public/${filename}.worker.js`,
    format: 'iife',
    name: 'worker',
    globals: {
      '/wasm/tracer': 'init'
    }
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
    copy({
      targets: [
        {
          src: ['tracer/pkg/tracer_bg.wasm', 'tracer/pkg/tracer.js'],
          dest: 'public/wasm',
          rename: (name) => name === 'tracer.js' ? 'tracer.js' : 'tracer_bg.wasm'
        }
      ]
    }),
    analyzer({
      summaryOnly: true,
      limit: 10,
      filter: ({ size }) => size > 1000
    })
  ],
  external: ['/wasm/tracer']
})

export default [
  create_worker_config('vector'),
  create_worker_config('compressor'),
  create_worker_config('tracer')
]
