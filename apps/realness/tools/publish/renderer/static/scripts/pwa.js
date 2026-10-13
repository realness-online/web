/** Keep updates waiting until all pages close; never reload or discard page state. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('/service.worker.js')
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update()
    })
  }, { once: true })
}
