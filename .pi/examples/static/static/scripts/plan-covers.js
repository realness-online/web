const reveal = () => {
  if (document.documentElement.dataset.diagrams === 'pending') {
    document.documentElement.dataset.diagrams = 'ready'
  }
}

const articles = [...document.querySelectorAll('section > article:has(> template)')]
for (const article of articles) {
  const figure = article.querySelector(':scope > figure')
  if (!figure || figure.querySelector('img, pre.mermaid')) continue
  const template = article.querySelector(':scope > template')
  if (!(template instanceof HTMLTemplateElement)) continue
  const diagrams = template.content.querySelectorAll('pre.mermaid')
  figure.prepend(...[...diagrams].map(diagram => diagram.cloneNode(true)))
}

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
