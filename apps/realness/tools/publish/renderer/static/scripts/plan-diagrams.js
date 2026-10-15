/** Add keyboard and pointer size controls after Mermaid renders. */
export const size_diagrams = (diagrams) => {
  for (const diagram of diagrams.filter(node => node.closest('section[itemprop="articleBody"]'))) {
    const svg = diagram.querySelector('svg')
    svg.setAttribute('width', String(svg.viewBox.baseVal.width))
    svg.setAttribute('height', String(svg.viewBox.baseVal.height))
    diagram.setAttribute('role', 'button')
    diagram.setAttribute('tabindex', '0')
    diagram.setAttribute('aria-label', 'Full-size diagram')
    diagram.setAttribute('aria-pressed', 'false')
    /** @type {number | null} */
    let scroll_left = null
    let scroll_top = 0
    const toggle = () => {
      const expanded = diagram.getAttribute('aria-pressed') === 'true'
      if (expanded) {
        scroll_left = diagram.scrollLeft
        scroll_top = diagram.scrollTop
      }
      diagram.setAttribute('aria-pressed', String(!expanded))
      if (!expanded && scroll_left === null) {
        const first = svg.querySelector('.node')
        scroll_left = first ? first.getBoundingClientRect().left - diagram.getBoundingClientRect().left - diagram.clientWidth / 2 + first.getBoundingClientRect().width / 2 : 0
      }
      diagram.scrollLeft = expanded ? 0 : scroll_left
      diagram.scrollTop = expanded ? 0 : scroll_top
    }
    diagram.addEventListener('click', toggle)
    diagram.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      toggle()
    })
  }
}
