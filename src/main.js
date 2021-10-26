import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './workers/register_service_worker'
const me = localStorage.me
if (!me) localStorage.me = '/+'

createApp(App).use(router).mount('body')
