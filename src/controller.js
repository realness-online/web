console.log('I am the service worker');
workbox.core.setCacheNameDetails({prefix: "Realness"});
self.__precacheManifest = [].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});

// self.addEventListener('message', message => {
//   console.log(message)
//   if(message.data.action == 'skip_waiting') {
//     console.log('calling skipWaiting')
//     self.skipWaiting
//   }
// })

self.addEventListener('install', function(event) {
  self.skipWaiting().then(() => {
    clients.claim()
  })
});

self.addEventListener('activate', function(event) {
  console.log('calling self.update()')
  self.update()
});
