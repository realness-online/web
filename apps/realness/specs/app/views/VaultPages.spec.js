import { describe, it, expect } from 'vite-plus/test'
import { readFileSync } from 'node:fs'

const tab = readFileSync('src/app/content/vault-docs.md', 'utf8')
const thoughts = readFileSync('src/app/content/documentation.md', 'utf8')

describe('vault docs', () => {
  it('links to every vault page it describes', () => {
    const links = [...tab.matchAll(/\]\((\/vault[^)]*)\)/g)].map(m => m[1])
    expect(links).toEqual([
      '/vault',
      '/vault/page#Areas/Realness/pages/commands.html',
      '/vault/tools',
      '/vault/page#Areas/Realness/pages/maps/modules.html',
      '/vault/page#Areas/Realness/pages/maps/ways-in.html',
      '/vault/page#Areas/Realness/pages/key-layouts.html'
    ])
  })

  it('holds the vault sections, and thoughts docs do not', () => {
    for (const heading of [
      'Chat',
      'Your computer',
      'Loops',
      'Long-running work',
      'Organizations',
      'Work with the world',
      'Advanced planning'
    ]) {
      expect(tab).toContain(`## ${heading}\n`)
      expect(thoughts).not.toContain(`## ${heading}\n`)
    }
    expect(thoughts).not.toContain('### Vault\n')
  })
})

describe('the Vault tab and the vault skill', () => {
  const skill = readFileSync('../../.pi/skills/vault/SKILL.md', 'utf8')

  it('names every main folder the skill names', () => {
    for (const folder of [
      'Projects',
      'Areas',
      'Resources',
      'Archive',
      'Clippings'
    ]) {
      expect(skill).toContain(`\`${folder}/\``)
      expect(tab).toContain(`| \`${folder}/\``)
    }
  })

  it('gives the same note link and layouts as the skill', () => {
    expect(skill).toContain('`/vault/<itemid>`')
    expect(tab).toContain('`/vault/<itemid>`')
    for (const layout of ['article', 'canvas', 'deck', 'print']) {
      expect(skill).toContain(`\`${layout}\``)
      expect(tab).toContain(`\`${layout}\``)
    }
    expect(tab).not.toContain('#itemid')
  })
})
