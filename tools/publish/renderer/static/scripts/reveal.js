// <a data-reveal-target="id"> toggles the hidden panel with that id.
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-reveal-target]')
  if (!link) return
  const panel = document.getElementById(link.getAttribute('data-reveal-target'))
  if (!panel) return
  event.preventDefault()
  panel.hidden = !panel.hidden
  if (!panel.hidden) panel.scrollIntoView({ block: 'nearest' })
})
