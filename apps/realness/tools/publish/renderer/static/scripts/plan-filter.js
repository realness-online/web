const nav = document.querySelector('nav[aria-label="Plans by area"]')

if (nav) {
  const articles = /** @type {HTMLElement[]} */ ([
    ...document.querySelectorAll('section > article')
  ])
  const buttons = [...nav.querySelectorAll('button[data-area]')]
  nav.addEventListener('click', event => {
    const button =
      event.target instanceof Element
        ? event.target.closest('button[data-area]')
        : null
    if (!(button instanceof HTMLButtonElement)) return
    const { area } = button.dataset
    for (const article of articles)
      article.hidden = Boolean(area) && article.dataset.area !== area
    for (const other of buttons)
      other.setAttribute('aria-pressed', String(other === button))
  })
}
