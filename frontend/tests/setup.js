import '@testing-library/jest-dom'
import { vi } from 'vite-plus/test'
import { h } from 'vue'
import { config } from '@vue/test-utils'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'fs'

// Setup Vue Test Utils global config
// AsAnimation holds an SVG-only template (nested `<animate>` elements), which
// Vue's runtime cannot render once shallowMount stubs it - it only keeps the
// setup. A bare stub with no render function trips Vue's noisy "missing
// template or render function" warning, so give it a render that returns a
// plain element instead. Tests that need AsAnimation's exposed state override
// this stub (per-mount stubs win over this global one).
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

// Provide set_working globally for all tests
config.global.provide = {
  set_working: vi.fn()
}

// Global test configuration for Composition API
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

// Import all browser mocks
import './mocks/browser/FileReaderSync'
import './mocks/browser/IntersectionObserver'
import './mocks/browser/console'
import './mocks/browser/createrange'
import './mocks/browser/fetch'
import './mocks/browser/scrollIntoView'
import './mocks/browser/worker'
import './mocks/browser/svg'

// Import default mocks
import './mocks/default'

// Mock window properties
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

// Get the tests directory path
const __dirname = dirname(fileURLToPath(import.meta.url))

global.resolve_mock_path = path => {
  // Remove the @@ prefix and resolve from tests/mocks directory
  const clean_path = path.replace('@@/', 'mocks/')
  return join(__dirname, clean_path)
}

global.read_mock_file = path => fs.readFileSync(resolve_mock_path(path), 'utf8')

// Mock IntersectionObserver for components that use it
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

// Mock ResizeObserver
global.ResizeObserver = vi.fn(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }
})
