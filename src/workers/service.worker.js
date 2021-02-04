/* eslint-disable no-undef */
workbox.core.setCacheNameDetails({ prefix: 'Realness' })
self.__precacheManifest = [].concat(self.__precacheManifest || [])
workbox.precaching.precacheAndRoute(self.__precacheManifest, {})
self.addEventListener('install', event => {
  self.skipWaiting().then(() => {
    window.reload()
  })
})
self.addEventListener('activate', event => {
  clients.claim()
})
