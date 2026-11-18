/**
 * b5: the blog page takes the published blog's root size, and gives it back.
 */
import { afterEach as after_each, describe, expect, it } from 'vite-plus/test'
import { apply_blog_style, clear_blog_style } from '@/blog/blog-style'

const setup = () => {
  document.body.innerHTML = '<main id="realness"></main>'
  document.documentElement.style.fontSize = '21.28px'
}

after_each(() => {
  document.body.innerHTML = ''
  document.documentElement.style.fontSize = ''
  document.querySelector('style#blog-style')?.remove()
})

describe('@/blog/blog-style', () => {
  it('marks the app page as a blog page and installs the stylesheet', () => {
    setup()
    apply_blog_style()
    expect(
      document.querySelector('main#realness').hasAttribute('data-blog')
    ).toBe(true)
    expect(document.querySelector('style#blog-style')).not.toBeNull()
    expect(document.querySelectorAll('style#blog-style')).toHaveLength(1)
  })

  it('draws the blog type scale at a 16px root', () => {
    setup()
    apply_blog_style()
    expect(document.documentElement.style.fontSize).toBe('16px')
  })

  it('gives the app its own root size back', () => {
    setup()
    apply_blog_style()
    clear_blog_style()
    expect(
      document.querySelector('main#realness').hasAttribute('data-blog')
    ).toBe(false)
    expect(document.documentElement.style.fontSize).toBe('21.28px')
  })

  it('leaves the app root alone when a cleared page applies twice', () => {
    setup()
    apply_blog_style()
    apply_blog_style()
    clear_blog_style()
    clear_blog_style()
    expect(document.documentElement.style.fontSize).toBe('21.28px')
  })
})
