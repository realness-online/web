import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
const me = localStorage.me
if (!me) localStorage.me = '/+'

createApp(App).use(router).mount('body')
