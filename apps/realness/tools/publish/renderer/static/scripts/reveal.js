document.addEventListener('click', event => {
  const { target } = event
  if (!(target instanceof Element)) return
  const link = target.closest('a[data-reveal-target]')
  if (!link) return
  const id = link.getAttribute('data-reveal-target')
  if (!id) return
  const panel = document.getElementById(id)
  if (!panel) return
  event.preventDefault()
  panel.hidden = !panel.hidden
  if (!panel.hidden) panel.scrollIntoView({ block: 'nearest' })
})
