workbox.core.setCacheNameDetails({prefix: "Realness"});
self.__precacheManifest = [].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});

self.addEventListener('install', function(event) {
  self.skipWaiting().then(() => {
    clients.claim()
  })
});

self.addEventListener('activate', function(event) {
  self.update()
});
