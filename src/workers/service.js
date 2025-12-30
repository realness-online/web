const { workbox } = /** @type {any} */ (self)
const sw_self = /** @type {any} */ (self)

workbox.core.setCacheNameDetails({ prefix: 'Realness' })
sw_self.__precacheManifest = [].concat(sw_self.__precacheManifest || [])
workbox.precaching.precacheAndRoute(sw_self.__WB_MANIFEST)
sw_self.addEventListener('install', () => {
  sw_self.skipWaiting().then(() => {
    // https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68
    // Maybe one day we can handle updates to the service workers
    // but It works pretty good right now that eventually the changes roll out
  })
})
sw_self.addEventListener('activate', () => {
  sw_self.clients.claim()
})
