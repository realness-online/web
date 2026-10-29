/** The Realness PWA kit: register the worker, then update silently while hidden. */
import { register_pwa } from '/scripts/register.js'

/** Rooted URLs here, so a site published under a prefix gets them prefixed. */
const register = () =>
  register_pwa({ url: '/service.worker.js', start: '/', warm: true })
window.addEventListener('load', register, { once: true })
