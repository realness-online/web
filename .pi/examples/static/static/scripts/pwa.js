/** Realness's update rule: look on return, activate and reload while hidden and idle. */
import { watch_for_updates } from '/scripts/watch-for-updates.js'

if ('serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    async () => {
      await navigator.serviceWorker.register('/service.worker.js')
      watch_for_updates({
        workers: navigator.serviceWorker,
        doc: document,
        is_working: () => false,
        reload: () => location.reload()
      })
    },
    { once: true }
  )
}
