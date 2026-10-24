import '@testing-library/jest-dom'
import { vi } from 'vite-plus/test'
import { h } from 'vue'
import { config } from '@vue/test-utils'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'fs'

config.global.stubs = {
  'router-link': true,
  'router-view': true,
  AsAnimation: {
    name: 'AsAnimation',
    props: ['id', 'svg', 'paused', 'vector', 'in_view'],
    setup: () => ({}),
    render: () => h('as-animation-stub')
  }
}

config.global.provide = {
  set_working: vi.fn()
}

config.global.config = {
  globalProperties: {
    $router: {
      push: vi.fn(),
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn()
    },
    $route: {
      path: '/',
      params: {},
      query: {},
      hash: ''
    }
  }
}

import './mocks/browser/FileReaderSync'
import './mocks/browser/IntersectionObserver'
import './mocks/browser/console'
import './mocks/browser/createrange'
import './mocks/browser/fetch'
import './mocks/browser/scrollIntoView'
import './mocks/browser/worker'
import './mocks/browser/svg'

import './mocks/default'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(function (query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }
  })
})

const __dirname = dirname(fileURLToPath(import.meta.url))

global.resolve_mock_path = path => {
  const clean_path = path.replace('@@/', 'mocks/')
  return join(__dirname, clean_path)
}

global.read_mock_file = path => fs.readFileSync(resolve_mock_path(path), 'utf8')

global.IntersectionObserver = vi.fn(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: []
  }
})

global.ResizeObserver = vi.fn(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }
})
