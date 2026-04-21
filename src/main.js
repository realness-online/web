import { createApp, effectScope, watch } from 'vue'
import { registerSW } from 'virtual:pwa-register'

import App from '@/App.vue'
import router from '@/router'
import { key_commands_plugin } from '@/plugins/key-commands'
import { init_serverless } from '@/utils/serverless'
import { log_storage_estimate } from '@/utils/storage-estimate'
import { homescreen_icon } from '@/utils/preference'
import { apply_homescreen_icon } from '@/utils/homescreen-icon'

const { me } = localStorage
if (!me) localStorage.me = '/+'

if (location.hostname !== 'realness.local') registerSW({ onOfflineReady() {} })
init_serverless()
void log_storage_estimate()

const homescreen_icon_scope = effectScope()
homescreen_icon_scope.run(() => {
  watch(
    homescreen_icon,
    variant => {
      if (variant === 'brand' || variant === 'poster')
        void apply_homescreen_icon(variant)
    },
    { immediate: true }
  )
})

createApp(App).use(router).use(key_commands_plugin).mount('body')
