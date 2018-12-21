import Vue from 'vue'
import VueRouter from 'vue-router'
import * as firebase from 'firebase/app'
import app from '@/components/application'
import events from '@/pages/events'
import feed from '@/pages/feed'
import where from '@/pages/where'
import account from '@/pages/account'
import index from '@/pages/index'
import profile from '@/pages/profile'
import avatar from '@/pages/avatar'
import relations from '@/pages/relations'
import phonebook from '@/pages/phonebook'
import { register } from 'register-service-worker'
if (process.env.NODE_ENV === 'production') {
  console.log('running registration')
  register('/controller.js', {
    ready (registration) {
      console.log('Service worker is active.')
    },
    registered (registration) {
      console.log('Service worker has been registered.')
    },
    cached (registration) {
      console.log('Content has been cached for offline use.')
    },
    updatefound (registration) {
      console.log('New content is downloading.')
    },
    updated (registration) {
      console.log('New content is available; please refresh.')
    },
    offline () {
      console.log('No internet connection found. App is running in offline mode.')
    },
    error (error) {
      console.error('Error during service worker registration:', error)
    }
  })
}
firebase.initializeApp(process.env.FIREBASE_CONFIG)
Vue.prototype.$bus = new Vue({})
Vue.use(VueRouter)
Vue.config.productionTip = false
const routes = [
  { path: '/', component: index },
  { path: '/events', component: events },
  { path: '/feed', component: feed },
  { path: '/where', component: where },
  { path: '/relations', component: relations },
  { path: '/phonebook', component: phonebook },
  { path: '/profile', component: profile },
  { path: '/account', component: account },
  { path: '/:phone_number/avatar', component: avatar },
  { path: '/:phone_number', component: profile }
]
const router = new VueRouter({
  routes,
  mode: 'history'
})
/* eslint-disable no-new */
new Vue({
  el: '#loading-realness',
  router,
  render: h => h(app)
})
