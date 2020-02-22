workbox.core.setCacheNameDetails({ prefix: 'Realness' })
self.__precacheManifest = [].concat(self.__precacheManifest || [])
workbox.precaching.precacheAndRoute(self.__precacheManifest, {})
self.addEventListener('install', event => {
  self.skipWaiting().then(() => {
    clients.claim()
  })
})
self.addEventListener('activate', event => {
  clients.claim()
})
