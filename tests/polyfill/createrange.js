global.Range = function Range() {}

const createContextualFragment = html => {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

Range.prototype.createContextualFragment = html =>
  createContextualFragment(html)

// HACK: Polyfil that allows codemirror to render in a JSDOM env.
global.window.document.createRange = () => {
  return {
    setEnd: () => {},
    setStart: () => {},
    getBoundingClientRect: () => {
      return { right: 0 }
    },
    getClientRects: () => [],
    createContextualFragment
  }
}
