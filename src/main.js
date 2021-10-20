import { createApp, configureCompat } from 'vue'
import App from './App.vue'
import router from './router'
import './workers/register_service_worker'
const me = localStorage.me
if (!me) localStorage.me = '/+'

// TODO: remove after 3.2
configureCompat({
  WATCH_ARRAY: false
})

createApp(App).use(router).mount('body')
