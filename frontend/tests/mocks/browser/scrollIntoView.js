import { vi } from 'vite-plus/test'

window.HTMLElement.prototype.scrollIntoView = vi.fn()
