/** @type {string | null} */
let stamp = null
setInterval(async () => {
  const next = await fetch('/build-stamp.txt', { cache: 'no-store' })
    .then(response => response.text())
    .catch(() => null)
  if (!next) return
  if (stamp && next !== stamp) location.reload()
  stamp = next
}, 400)
