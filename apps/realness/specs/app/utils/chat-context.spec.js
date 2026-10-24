import { afterEach as after_each, describe, expect, it } from 'vite-plus/test'
import { page_context } from '@/utils/chat-context'

after_each(() => {
  document.body.innerHTML = ''
})

describe('page context', () => {
  it('includes page text but excludes navigation, drafts, hidden content and query credentials', () => {
    document.body.innerHTML =
      '<section aria-label="Current page"><nav>Navigation</nav><h1>Docs</h1><p>Poster controls</p><form>Private form<input value="secret" /></form><p contenteditable>Unsent thought</p><aside hidden>Hidden content</aside></section><aside id="chat-panel">Conversation</aside>'
    expect(
      page_context({
        path: '/docs',
        hash: '#posters',
        query: { token: 'secret' }
      })
    ).toEqual({
      path: '/docs#posters',
      title: 'Docs',
      text: 'Docs Poster controls'
    })
  })

  it('leaves out the header, its buttons and icons', () => {
    document.body.innerHTML =
      '<section aria-label="Current page"><header><a>Sco</a><button>3<svg><text>?</text></svg>0 0-p</button><h1>Thoughts</h1></header><h4>Wednesday, October 21</h4></section>'
    expect(page_context({ path: '/' })).toEqual({
      path: '/',
      title: 'Thoughts',
      text: 'Wednesday, October 21'
    })
  })

  it('bounds the page excerpt', () => {
    document.body.innerHTML = `<section aria-label="Current page"><p>${'a'.repeat(4000)}</p></section>`
    expect(page_context({ path: '/' }).text).toHaveLength(3000)
  })
})
