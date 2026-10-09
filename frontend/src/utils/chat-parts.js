import {
  card_html,
  mermaid_config
} from '#root/tools/publish/renderer/static/scripts/parts.js'

const load_mermaid = async () => (await import('mermaid')).default

/**
 * A drawer for the inert parts `message_html` leaves in a conversation, with
 * the code published pages use. A streaming reply re-renders its message on
 * every chunk, so each diagram is drawn once, kept by its source, and put
 * back synchronously after each render. Busy (still streaming) parts wait.
 * Cards carry no remote images in chat. A diagram that fails stays text.
 * @param {() => Promise<{initialize: Function, render: Function}>} [load]
 * @returns {(root: Element) => Promise<void>}
 */
export const create_parts = (load = load_mermaid) => {
  const svgs = new Map()
  const pending = new Map()
  /** @type {ReturnType<typeof load> | null} */
  let ready = null
  let count = 0
  const mermaid = () =>
    (ready ??= load().then(found => {
      // Natural size: a narrow column must not shrink labels; wide ones scroll.
      const config = mermaid_config()
      found.initialize({
        ...config,
        flowchart: { ...config.flowchart, useMaxWidth: false }
      })
      return found
    }))
  const render = source => {
    if (!pending.has(source))
      pending.set(
        source,
        mermaid()
          .then(found => found.render(`chat-part-${++count}`, source))
          .then(
            ({ svg }) => svgs.set(source, svg),
            () => svgs.set(source, null)
          )
      )
    return pending.get(source)
  }
  const place = (pre, svg) => {
    if (svg === null) return pre.removeAttribute('aria-busy')
    pre.innerHTML = svg
    pre.removeAttribute('aria-busy')
    pre.setAttribute('data-processed', 'true')
  }

  return async root => {
    for (const pre of root.querySelectorAll('pre.cardlink:not([aria-busy])')) {
      const html = card_html(pre.textContent, { images: false })
      if (html) pre.outerHTML = html
    }
    const waiting = []
    for (const pre of root.querySelectorAll(
      'pre.mermaid:not([aria-busy]):not([data-processed])'
    )) {
      const source = pre.textContent
      if (svgs.has(source)) {
        place(pre, svgs.get(source))
        continue
      }
      pre.setAttribute('aria-busy', 'true')
      waiting.push(
        render(source).then(() => {
          if (pre.isConnected) place(pre, svgs.get(source))
        })
      )
    }
    await Promise.all(waiting)
  }
}
