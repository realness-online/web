import { createApp } from 'vue'
import { registerSW as register_service_worker } from 'virtual:pwa-register'
import { eight_hours } from '@/use/sync'

import App from './App.vue'
import router from './router'
const me = localStorage.me
if (!me) localStorage.me = '/+'

const update_servie_worker = register_service_worker({
  onOfflineReady() {
    console.info('sw-offline-ready', update_servie_worker)
  },
  onRegistered(r) {
    console.info('sw-registered', r)
    r && setInterval(() => {
      console.info('sw-interval-check', r)
      r.update()
    }, eight_hours)
  }
})
createApp(App).use(router).mount('body')
