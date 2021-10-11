/* eslint-disable no-undef */
workbox.core.setCacheNameDetails({ prefix: 'Realness' })
self.__precacheManifest = [].concat(self.__precacheManifest || [])
workbox.precaching.precacheAndRoute(self.__precacheManifest, {})
self.addEventListener('install', () => {
  self.skipWaiting().then(() => {
    // https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68
    // Maybe one day we can handle updates to the service workers
    // but It works pretty good right now that eventually the changes roll out
  })
})
self.addEventListener('activate', () => {
  clients.claim()
})
