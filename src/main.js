import Vue from 'vue'
import VueRouter from 'vue-router'
import * as firebase from 'firebase/app'
import app from '@/components/application'
import events from '@/pages/events'
import feed from '@/pages/feed'
import upload from '@/pages/upload'
import where from '@/pages/where'
import account from '@/pages/account'
import index from '@/pages/index'
import profile from '@/pages/profile'
import relations from '@/pages/relations'
import phonebook from '@/pages/phonebook'

// if (process.env.NODE_ENV === 'production') {
//   if ('serviceWorker' in navigator) {
//     navigator.serviceWorker.register('/controller.js').then(registration => {
//       registration.update()
//       console.log('ServiceWorker registed!', registration)
//     }).catch(registrationError => {
//       console.log('ServiceWorker registration failed: ', registrationError)
//     })
//   }
// }
firebase.initializeApp(process.env.FIREBASE_CONFIG)
Vue.prototype.$bus = new Vue({})
Vue.use(VueRouter)
Vue.config.productionTip = false
const routes = [
  { path: '/', component: index },
  { path: '/events', component: events },
  { path: '/feed', component: feed },
  { path: '/where', component: where },
  { path: '/account', component: account },
  { path: '/relations', component: relations },
  { path: '/phonebook', component: phonebook },
  { path: '/profile', component: profile },
  { path: '/upload', component: upload },
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
