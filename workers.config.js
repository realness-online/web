import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'
import alias from '@rollup/plugin-alias'
import analyzer from 'rollup-plugin-analyzer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const create_worker_config = filename => ({
  input: `workers/${filename}.js`,
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
          replacement: path.resolve(__dirname, './') // adjust this path based on your project structure
        }
      ]
    }),
    resolve({
      browser: true
    }),
    commonjs(),
    analyzer({
      summaryOnly: true,
      limit: 10,
      filter: ({ size }) => size > 1000
    })
  ]
})

export default [create_worker_config('vector')]
