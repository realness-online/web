import { vi } from 'vitest'

if (typeof Element !== 'undefined' && !Element.prototype.getTotalLength)
  Element.prototype.getTotalLength = vi.fn().mockReturnValue(100)
if (typeof global.SVGPathElement !== 'undefined')
  global.SVGPathElement.prototype.getTotalLength = vi.fn().mockReturnValue(100)
