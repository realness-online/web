/**
 * Temporary instrumentation for the empty-statement-over-a-poster hunt. An
 * empty statement in a poster overlay does not open for editing when clicked,
 * and every layer in isolation says it should - so this reports what the live
 * page actually does. Filter the console on `[statement-edit]`.
 *
 * Delete this file, and its callers, once the culprit is caught.
 *
 * @param {string} where
 * @param {Record<string, unknown>} [detail]
 */
export const statement_edit_log = (where, detail = {}) => {
  console.info(`[statement-edit] ${where}`, detail)
}

/**
 * A statement so short it has nothing to show is described by where it sits
 * and how big it is, not by its text.
 * @param {Element | null | undefined} el
 */
const as_box = el => {
  if (!el) return null
  const { x, y, width, height } = el.getBoundingClientRect()
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(width),
    h: Math.round(height)
  }
}

/**
 * @param {Element | null | undefined} el
 */
const as_tag = el => {
  if (!el) return null
  const name = el.tagName.toLowerCase()
  const itemprop = el.getAttribute?.('itemprop')
  const itemid = el.getAttribute?.('itemid')
  return [name, itemprop && `[${itemprop}]`, itemid].filter(Boolean).join(' ')
}

let probe_installed = false

/**
 * The click that never arrives is the whole question, so this listens on the
 * document in the capture phase - before anything can stop it - and reports
 * what the pointer actually landed on versus the statement it was aimed at.
 */
export const install_statement_edit_probe = () => {
  if (probe_installed || typeof document === 'undefined') return
  probe_installed = true

  document.addEventListener(
    'pointerdown',
    event => {
      const { target } = /** @type {{ target: Element | null }} */ (
        /** @type {unknown} */ (event)
      )
      const figure = target?.closest?.('figure')
      if (!figure) return
      const aside = figure.querySelector('figcaption aside')
      const wrappers = Array.from(aside?.querySelectorAll('[itemscope]') ?? [])
      const top = document.elementFromPoint(event.clientX, event.clientY)
      statement_edit_log('pointerdown over a poster', {
        at: { x: Math.round(event.clientX), y: Math.round(event.clientY) },
        pointer: event.pointerType,
        hit: as_tag(target),
        top_of_stack: as_tag(top),
        overlay_open: figure.getAttribute('aria-expanded'),
        aside_box: as_box(aside),
        statements: wrappers.map(wrapper => ({
          itemid: wrapper.getAttribute('itemid'),
          editable: wrapper.getAttribute('data-editable'),
          text: JSON.stringify(
            wrapper.querySelector('[itemprop="statement"]')?.textContent
          ),
          box: as_box(wrapper.querySelector('[itemprop="statement"]')),
          contains_hit: wrapper.contains(target)
        }))
      })
    },
    true
  )
}
