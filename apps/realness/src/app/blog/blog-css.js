/**
 * The published blog's stylesheet, limited to the blog page inside the app.
 * One renderer stylesheet feeds both; nothing is copied.
 */

const DROPPED = /^@font-face\b/
/** The page's own blocks: their rules belong to the blog page, not the app. */
const PAGE = /^(:root|body|main)\b/
const TOP_LEVEL = /^@(keyframes|page)\b/

/**
 * A stylesheet's top-level blocks, comments removed.
 * @param {string} text
 * @returns {string[]}
 */
const blocks = text => {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const found = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quote) {
      if (char === quote && source[i - 1] !== '\\') quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '{') {
      if (depth === 0 && source.slice(start, i).trim() === '') start = i + 1
      depth++
    }
    if (char === '}' && --depth === 0) {
      found.push(source.slice(start, i + 1).trim())
      start = i + 1
    }
  }
  return found.filter(block => block !== '')
}

/** A block's direct-child selectors, which a nested page cannot satisfy. */
const unwrap = block => block.replace(/\n(\s*)> /g, '\n$1')

/** The app limits every paragraph's width; the blog measures by its column. */
const APP_PARAGRAPH = 'main[data-blog] p {\n  max-width: none;\n}'

/**
 * The renderer stylesheet with its page-wide rules held to the blog page:
 * fonts dropped, `:root`, `body`, and `main` becoming `main[data-blog]`, and
 * every other rule nested under it. Keyframes and print pages stay global.
 * @param {string} text the renderer's `static/style.css`
 * @returns {string}
 */
export const limit_blog_css = text => {
  const held = blocks(text)
    .filter(block => !DROPPED.test(block))
    .map(block => {
      if (TOP_LEVEL.test(block)) return block
      if (PAGE.test(block))
        return unwrap(block).replace(PAGE, 'main[data-blog]')
      return `main[data-blog] {\n${block}\n}`
    })
    .join('\n')
  return `${held}\n${APP_PARAGRAPH}`
}
