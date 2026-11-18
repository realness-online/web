import renderer_css from '../../../tools/publish/renderer/static/style.css?inline'
import { limit_blog_css } from './blog-css'

const limited = limit_blog_css(renderer_css)
const MAIN = 'main#realness'
/** The published blog's type scale is drawn at a 16px root. */
const BLOG_ROOT = '16px'

/** @type {string | null} */
let root_before = null

/** The blog page wears the published blog's styles. */
export const apply_blog_style = () => {
  document.querySelector(MAIN)?.setAttribute('data-blog', '')
  const root = document.documentElement
  if (root_before === null) root_before = root.style.fontSize
  root.style.fontSize = BLOG_ROOT
  if (document.querySelector('style#blog-style')) return
  const style = document.createElement('style')
  style.id = 'blog-style'
  style.textContent = limited
  document.head.append(style)
}

/** The rest of the app wears its own. */
export const clear_blog_style = () => {
  document.querySelector(MAIN)?.removeAttribute('data-blog')
  if (root_before === null) return
  document.documentElement.style.fontSize = root_before
  root_before = null
}
