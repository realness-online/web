import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'

import App from '@/App.vue'
import router from '@/router'
import { key_commands_plugin } from '@/plugins/key-commands'
import { init_serverless } from '@/utils/serverless'
import { log_storage_estimate } from '@/utils/storage-estimate'
import '@/use/install' // register beforeinstallprompt capture at boot, before any lazy route

const { me } = localStorage
if (!me) localStorage.me = '/+'

const mount_el = document.getElementById('app') ?? document.body
createApp(App).use(router).use(key_commands_plugin).mount(mount_el)

// Init Firebase after mount so first paint is not blocked.
if (import.meta.env.PROD && location.hostname !== 'realness.local')
  registerSW({ onOfflineReady() {} })
init_serverless()
void log_storage_estimate()

// Static site nav is for crawlers and no-JS only; the app has its own nav.
document.getElementById('site')?.remove()
