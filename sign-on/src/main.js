import { createApp } from 'vue'
import SignOn from './sign-on.vue'
import LoopsAdmin from './loops-admin.vue'
import Pay from './pay.vue'
import { init_auth } from './utils/firebase'
import './style.css'

init_auth()

/* The URL is the state: a waiting program puts its port and state in the
   query, so the page reads them once and passes them down. */
const path = window.location.pathname.replace(/\/+$/, '')
const pages = { '/admin': LoopsAdmin, '/pay': Pay }
const page = pages[path] ?? SignOn
createApp(page, {
  ...(page === SignOn ? { query: Object.fromEntries(new URLSearchParams(window.location.search)) } : {})
}).mount('#app')
