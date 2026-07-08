import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'

import '@/style/font.css'
import '@/style/palette.css'
import '@/style/color.css'
import '@/style/keyframes.css'
import '@/style/aspect-ratio.css'
import '@/style/elements/index.css'
import App from '@/App.vue'
import router from '@/router'
import { key_commands_plugin } from '@/plugins/key-commands'
import { init_serverless } from '@/utils/serverless'
import { log_storage_estimate } from '@/utils/storage-estimate'
import { probe_instance_capabilities } from '@/use/instance-capabilities'
import '@/use/install' // register beforeinstallprompt capture at boot, before any lazy route

const { me } = localStorage
if (!me) localStorage.me = '/+'

const mount_el = document.getElementById('app') ?? document.body
createApp(App).use(router).use(key_commands_plugin).mount(mount_el)

// Static site nav is for crawlers and no-JS only; the app has its own nav.
document.getElementById('site')?.remove()

// Defer Firebase, SW, and probes until after first paint.
requestAnimationFrame(() => {
  if (import.meta.env.PROD && location.hostname !== 'realness.local')
    registerSW({ onOfflineReady() {} })
  init_serverless()
  void log_storage_estimate()
  void probe_instance_capabilities()
})
