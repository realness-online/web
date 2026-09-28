import { createApp } from 'vue'
import SignOn from './sign-on.vue'
import { init_auth } from './utils/firebase'
import './style.css'

init_auth()

/* The URL is the state: a waiting program puts its port and state in the
   query, so the page reads them once and passes them down. */
createApp(SignOn, {
  query: Object.fromEntries(new URLSearchParams(window.location.search))
}).mount('#app')
