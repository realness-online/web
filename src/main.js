import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'

import App from './App.vue'
import router from './router'
const me = localStorage.me
if (!me) localStorage.me = '/+'

const update_servie_worker = registerSW({
  onOfflineReady() {
    console.log('offline_ready', update_servie_worker)
  }
})

createApp(App).use(router).mount('body')
