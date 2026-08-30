import { describe, it, expect } from 'vite-plus/test'
import prompt from '@/content/agent-prompt-poster-driver.md?raw'

describe('@/content/agent-prompt-poster-driver', () => {
  // An agent handed a prompt cannot check the page it describes. If the driver's
  // shape changes, these are the sentences that quietly start lying.
  it('names the function and options the driver actually exposes', () => {
    expect(prompt).toContain('window.poster_driver.render')
    expect(prompt).toContain('window.poster_driver.ready')
    expect(prompt).toContain('get_status()')
    expect(prompt).toContain("formats: ['png', 'psd', 'glb']")
  })

  it('names the harness video script and its real flags', () => {
    expect(prompt).toContain('npm run make:animation')
    expect(prompt).toContain('--fps')
    expect(prompt).toContain('--workers')
    expect(prompt).toContain('REALNESS_URL')
  })

  it('warns that renders are serialized', () => {
    expect(prompt).toMatch(/one render at a time/i)
  })
})
