import '@testing-library/jest-dom'
import { vi, expect } from 'vitest'
import { config } from '@vue/test-utils'

// Setup Vue Test Utils global config
config.global.stubs = {
  'router-link': true,
  'router-view': true
}

// Import all browser mocks
import './mocks/browser/FileReaderSync'
import './mocks/browser/IntersectionObserver'
import './mocks/browser/console'
import './mocks/browser/createrange'
import './mocks/browser/fetch'
import './mocks/browser/scrollIntoView'
import './mocks/browser/worker'

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
