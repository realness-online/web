import { createApp } from 'vue'
import VueHotkey from 'v-hotkey'
import App from './App.vue'
import router from './router'
import './workers/register_service_worker'
const me = localStorage.me
if (!me) localStorage.me = '/+'

createApp(App).use(router).directive('hotkey', {
  beforeMount: VueHotkey.directive.bind,
  updated: VueHotkey.directive.componentUpdated,
  unmounted: VueHotkey.directive.unbind,
}).mount('body')
