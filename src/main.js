import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'

import App from '@/App.vue'
import router from '@/router'
import { key_commands_plugin } from '@/plugins/key-commands'

const { me } = localStorage
if (!me) localStorage.me = '/+'

const update_service_worker = registerSW({
  onOfflineReady() {
    console.info('offline-ready', update_service_worker)
  }
})

createApp(App).use(router).use(key_commands_plugin).mount('body')
