import { vi } from 'vitest'

// Mock getTotalLength for SVG path elements
// Add it to Element prototype since happy-dom doesn't have SVGPathElement.getTotalLength
if (typeof Element !== 'undefined' && !Element.prototype.getTotalLength) {
  Element.prototype.getTotalLength = vi.fn().mockReturnValue(100)
}

// Also try to mock SVGPathElement if it exists
if (typeof global.SVGPathElement !== 'undefined') {
  global.SVGPathElement.prototype.getTotalLength = vi.fn().mockReturnValue(100)
}
