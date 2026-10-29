/** The Realness PWA kit: register the worker, then update silently while hidden. */
import { register_pwa } from '/scripts/register.js'

// Rooted URLs here, so a site published under a prefix gets them prefixed.
window.addEventListener(
  'load',
  () => register_pwa({ url: '/service.worker.js', start: '/', warm: true }),
  { once: true }
)
