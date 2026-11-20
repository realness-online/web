const body = document.querySelector("section[itemprop='articleBody']")
if (body) {
  const slides = []
  let slide = document.createElement('section')
  slide.dataset.slide = ''
  for (let node = body.firstChild; node; node = body.firstChild) {
    if (node.nodeName === 'HR') {
      node.remove()
      slides.push(slide)
      slide = document.createElement('section')
      slide.dataset.slide = ''
      continue
    }
    slide.append(node)
  }
  const heading = /** @type {HTMLElement | null} */ (
    document.querySelector('article[itemscope] > header')
  )
  if (heading) {
    slides.unshift(heading)
    heading.dataset.slide = ''
  }
  slides.push(slide)
  body.append(...slides)
  const position = document.createElement('p')
  position.className = 'deck-position'
  position.setAttribute('aria-live', 'polite')
  document.body.append(position)
  let at = 0
  const show = next => {
    at = (next + slides.length) % slides.length
    slides.forEach((each, index) =>
      index === at ? (each.dataset.current = '') : delete each.dataset.current
    )
    position.textContent = `${at + 1} / ${slides.length}`
  }
  addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === ' ') show(at + 1)
    if (event.key === 'ArrowLeft') show(at - 1)
  })
  show(0)
}
