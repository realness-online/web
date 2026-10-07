/* global self, clients */
// Web Push handlers imported into the generated service worker via
// VitePWA `workbox.importScripts`. Kept here (not in the bundled SW) so the
// generateSW precaching strategy is untouched. Payload shape is decided by the
// send path in realness-functions: { title, body, url, icon, badge, tag }.

self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Realness'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/192.png',
    badge: payload.badge || '/192.png',
    tag: payload.tag,
    data: { url: payload.url || '/' }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      for (const client of windows) {
        const path = new URL(client.url).pathname
        if (path === target || target === '/') {
          await client.focus()
          if ('navigate' in client && path !== target)
            await client.navigate(target)
          return
        }
      }
      await clients.openWindow(target)
    })()
  )
})
