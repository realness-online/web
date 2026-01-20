import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'fs'

// Setup Vue Test Utils global config
config.global.stubs = {
  'router-link': true,
  'router-view': true
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
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Get the tests directory path
const __dirname = dirname(fileURLToPath(import.meta.url))

global.resolve_mock_path = path => {
  // Remove the @@ prefix and resolve from tests/mocks directory
  const clean_path = path.replace('@@/', 'mocks/')
  return join(__dirname, clean_path)
}

global.read_mock_file = path => fs.readFileSync(resolve_mock_path(path), 'utf8')

// Mock localStorage for tests
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  },
  writable: true
})

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = vi.fn().mockImplementation(callback => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: []
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(callback => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
