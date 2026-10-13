import { createApp as create_app } from 'vue'
import { createRouter as create_router, createWebHashHistory as create_web_hash_history } from 'vue-router'
import App from './App.vue'
import Notes from './views/Notes.vue'
import Note from './views/Note.vue'

// Hash history: a static host needs no rewrite rules.
const router = create_router({
  history: create_web_hash_history(),
  routes: [
    { path: '/', component: Notes },
    { path: '/notes/:created', component: Note, props: true }
  ]
})

create_app(App).use(router).mount('#app')
