import { createApp as create_app } from 'vue'
import { registerSW as register_sw } from 'virtual:pwa-register'

import '@/style/font.css'
import '@/style/palette.css'
import '@/style/color.css'
import '@/style/keyframes.css'
import '@/style/motion.css'
import '@/style/aspect-ratio.css'
import '@/style/elements/index.css'
import App from '@/App.vue'
import router from '@/router'
import { key_commands_plugin } from '@/plugins/key-commands'
import { log_storage_estimate } from '@/utils/storage-estimate'
import { probe_instance_capabilities } from '@/use/instance-capabilities'
import '@/use/install'

const { me } = localStorage
if (!me) localStorage.me = '/+'

const mount_el = document.querySelector('main#realness') ?? document.body
create_app(App).use(router).use(key_commands_plugin).mount(mount_el)

document.getElementById('site')?.remove()

requestAnimationFrame(async () => {
  if (import.meta.env.PROD && location.hostname !== 'realness.local')
    register_sw({ onOfflineReady() {} })
  const { init_auth } = await import('@/utils/serverless-auth')
  init_auth()
  void log_storage_estimate()
  void probe_instance_capabilities()
})
