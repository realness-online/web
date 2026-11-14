/**
 * Plans draw their Mermaid diagrams in the app, not in a build. A note's fenced
 * blocks become `pre.mermaid` first, then Pele mounts them.
 */
/* eslint-disable no-await-in-loop -- one diagram at a time, so a broken one cannot stop the next */

/**
 * Draw every `pre.mermaid` inside a container, one at a time so a diagram with
 * a broken source keeps its own text and the others still draw. Pele loads
 * once, and only when a block needs it.
 * @param {HTMLElement | null | undefined} container
 * @returns {Promise<string[]>} the sources that would not draw
 */
export const draw_diagrams = async container => {
  const blocks = [
    ...(container?.querySelectorAll(/** @type {'pre'} */ ('pre.mermaid')) ?? [])
  ]
  if (!blocks.length) return []
  const [{ draw_diagrams: draw }, { size_diagrams }, pele] = await Promise.all([
    import('#root/tools/publish/renderer/static/scripts/parts.js'),
    import('#root/tools/publish/renderer/static/scripts/plan-diagrams.js'),
    import('pele')
  ])
  const failed = []
  const drawn = []
  for (const block of blocks) {
    const source = block.textContent ?? ''
    const ok = await draw([block], () => Promise.resolve(pele)).then(
      () => true,
      () => false
    )
    if (ok) {
      drawn.push(block)
      continue
    }
    failed.push(source)
    block.textContent = source
  }
  size_diagrams(drawn)
  return failed
}

/**
 * A note's fenced Mermaid blocks become drawable, the way the plans build
 * writes them.
 * @param {HTMLElement | null | undefined} container
 */
export const mark_diagrams = container => {
  for (const code of container?.querySelectorAll(
    'pre > code.language-mermaid'
  ) ?? []) {
    const pre = code.parentElement
    if (!pre) continue
    pre.className = 'mermaid'
    pre.textContent = code.textContent
  }
}
