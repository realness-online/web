// plans: diagrams become covers
// Reveal the page once every diagram is drawn. The gate hides the body so the
// raw fence text never paints; the covers are only the first screenful.
const reveal = () => {
  if (document.documentElement.dataset.diagrams === 'pending') {
    document.documentElement.dataset.diagrams = 'ready'
  }
}

const articles = [...document.querySelectorAll('section > article:has(> template)')]
// Each cover borrows its plan's diagrams from the inert <template> body.
for (const article of articles) {
  const figure = article.querySelector(':scope > figure')
  if (!figure || figure.querySelector('img, pre.mermaid')) continue
  const diagrams = article.querySelector(':scope > template').content.querySelectorAll('pre.mermaid')
  figure.prepend(...[...diagrams].map(diagram => diagram.cloneNode(true)))
}

// The copies made above must finish before diagrams.js reads the list, so wait
// for it, then reveal when every diagram is drawn. A plan page has its diagram
// in the body, not in a cover, so covers alone are not enough.
const watch = [...document.querySelectorAll('pre.mermaid')]
if (!watch.length) {
  reveal()
} else {
  requestAnimationFrame(() => {
    if (watch.every((diagram) => diagram.querySelector('svg'))) reveal()
    else {
      const observer = new MutationObserver(() => {
        if (watch.every((diagram) => diagram.querySelector('svg'))) {
          observer.disconnect()
          reveal()
        }
      })
      for (const diagram of watch) observer.observe(diagram, { childList: true })
    }
  })
}
