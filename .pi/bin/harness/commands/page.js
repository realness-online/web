/**
 * Filter and copy controls for the generated commands page. `filter` reads the
 * search box and the two filter groups and hides what does not match; `copy`
 * writes a command to the clipboard, or selects it when the clipboard refuses.
 */

/** @param {Document} document */
export const wire_page = document => {
  const search = document.querySelector('input[type="search"]')
  const output = document.querySelector('output')
  const sections = [...document.querySelectorAll('#command-list section')]
  const filters = document.querySelector('#command-filters')
  const review_filters = document.querySelector('#review-filters')

  const filter_commands = () => {
    const terms = search.value.toLowerCase().trim().split(/\s+/)
    const group = filters.querySelector('[aria-pressed="true"]').getAttribute('value')
    const review = review_filters.querySelector('[aria-pressed="true"]').getAttribute('value')
    let count = 0
    for (const section of sections) {
      const heading = section.querySelector('h2').textContent
      const excluded = group !== 'all' && heading !== group
      let visible = 0
      for (const row of section.querySelectorAll('li')) {
        const text =
          `${heading} ${row.querySelector('header').textContent} ${row.querySelector('strong').textContent} ${row.querySelector('details').textContent} ${row.querySelector('button').getAttribute('value')}`.toLowerCase()
        const review_excluded = review !== 'all' && row.querySelector('strong').textContent !== review
        row.hidden = excluded || review_excluded || !terms.every(term => text.includes(term))
        if (!row.hidden) visible++
      }
      section.hidden = visible === 0
      count += visible
    }
    output.textContent = count ? `${count} command${count === 1 ? '' : 's'}` : 'No commands found'
  }

  search.addEventListener('input', filter_commands)
  for (const fieldset of [filters, review_filters]) {
    fieldset.addEventListener('click', event => {
      const button = event.target.closest('button')
      if (!button) return
      for (const option of fieldset.querySelectorAll('button'))
        option.setAttribute('aria-pressed', String(option === button))
      filter_commands()
    })
  }
  filter_commands()

  document.querySelector('#command-list').addEventListener('click', async event => {
    const button = event.target.closest('button')
    if (!button) return
    const command = button.getAttribute('value')
    try {
      await navigator.clipboard.writeText(command)
      button.textContent = 'Copied'
      setTimeout(() => {
        button.textContent = 'Copy'
      }, 2000)
    } catch {
      button.textContent = 'Select to copy'
      const code = button.parentElement.querySelector('code')
      code.textContent = command
      const range = document.createRange()
      range.selectNodeContents(code)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    }
  })
}

if (typeof document !== 'undefined') wire_page(document)
