console.log('instantiated main.js')
import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'

import App from './App.vue'
import router from './router'
const me = localStorage.me
if (!me) localStorage.me = '/+'

const update_servie_worker = registerSW({
  onOfflineReady() {
    console.info('offline-ready', update_servie_worker)
  }
})

createApp(App).use(router).mount('body')
console.log('main finished')
