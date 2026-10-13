import { describe, it, expect, vi } from 'vite-plus/test'
import { create_parts } from '@/utils/chat-parts'
import { message_html } from '@/utils/message-markdown'

const fence = (lang, body) => `\`\`\`${lang}\n${body}\n\`\`\``

const conversation = text => {
  const root = document.createElement('section')
  root.innerHTML = message_html(text)
  document.body.append(root)
  return root
}

/** A stand-in mermaid whose render resolves when the test says so. */
const fake_mermaid = ({ fail = false } = {}) => {
  const releases = []
  const mermaid = {
    initialize: vi.fn(),
    render: vi.fn(
      (id, source) =>
        new Promise((resolve, reject) =>
          releases.push(() =>
            fail
              ? reject(new Error('parse error'))
              : resolve({ svg: `<svg data-source="${source}"></svg>` })
          )
        )
    )
  }
  const load = vi.fn(async () => mermaid)
  const release = async () => {
    while (!releases.length) await Promise.resolve()
    releases.splice(0).forEach(go => go())
  }
  return { mermaid, load, release }
}

describe('create_parts', () => {
  it('draws a card with the shared part and no remote images', async () => {
    const root = conversation(
      fence(
        'cardlink',
        'url: https://example.com\ntitle: Example\nimage: https://example.com/i.png\nfavicon: https://example.com/f.ico'
      )
    )
    await create_parts(fake_mermaid().load)(root)
    const card = root.querySelector('a[itemprop="url"]')
    expect(card.getAttribute('href')).toBe('https://example.com')
    expect(card.querySelector('[itemprop="name"]').textContent).toBe('Example')
    expect(root.querySelector('img')).toBeNull()
  })

  it('leaves a card without a web url as text', async () => {
    const root = conversation(fence('cardlink', 'url: javascript:alert(1)'))
    await create_parts(fake_mermaid().load)(root)
    expect(root.querySelector('a')).toBeNull()
    expect(root.querySelector('pre.cardlink')).not.toBeNull()
  })

  it('waits on parts whose fence is still streaming', async () => {
    const { load } = fake_mermaid()
    const root = conversation(
      '```mermaid\nflowchart LR\n  a -->\n\n```cardlink\nurl: https://a.b'
    )
    await create_parts(load)(root)
    expect(load).not.toHaveBeenCalled()
    expect(root.querySelector('a')).toBeNull()
  })

  it('holds a placeholder while drawing, then draws strictly', async () => {
    const { mermaid, load, release } = fake_mermaid()
    const root = conversation(fence('mermaid', 'flowchart LR'))
    const drawing = create_parts(load)(root)
    const pre = root.querySelector('pre.mermaid')
    expect(pre.getAttribute('aria-busy')).toBe('true')
    await release()
    await drawing
    expect(mermaid.initialize.mock.calls[0][0].securityLevel).toBe('strict')
    expect(pre.hasAttribute('aria-busy')).toBe(false)
    expect(pre.querySelector('svg')).not.toBeNull()
  })

  it('puts a drawn diagram back synchronously after a re-render', async () => {
    const { mermaid, load, release } = fake_mermaid()
    const draw = create_parts(load)
    const text = fence('mermaid', 'flowchart LR')
    const root = conversation(text)
    const first = draw(root)
    await release()
    await first

    root.innerHTML = message_html(`${text}\n\nmore words`)
    draw(root)
    expect(root.querySelector('pre.mermaid svg')).not.toBeNull()
    expect(mermaid.render).toHaveBeenCalledTimes(1)
  })

  it('draws into the newest element when a chunk lands mid-draw', async () => {
    const { mermaid, load, release } = fake_mermaid()
    const draw = create_parts(load)
    const text = fence('mermaid', 'flowchart LR')
    const root = conversation(text)
    const first = draw(root)
    root.innerHTML = message_html(`${text}\n\nmore`)
    const second = draw(root)
    await release()
    await Promise.all([first, second])
    expect(root.querySelector('pre.mermaid svg')).not.toBeNull()
    expect(mermaid.render).toHaveBeenCalledTimes(1)
  })

  it('skips mermaid when there is nothing to draw', async () => {
    const { load } = fake_mermaid()
    await create_parts(load)(conversation('just text'))
    expect(load).not.toHaveBeenCalled()
  })

  it('keeps fence text when a diagram fails to draw', async () => {
    const { load, release } = fake_mermaid({ fail: true })
    const root = conversation(fence('mermaid', 'not a diagram'))
    const drawing = create_parts(load)(root)
    await release()
    await drawing
    const pre = root.querySelector('pre.mermaid')
    expect(pre.hasAttribute('aria-busy')).toBe(false)
    expect(pre.textContent).toBe('not a diagram')
  })
})
