// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import VueRouter from 'vue-router'
import * as firebase from 'firebase/app'

import app from '@/components/application'
import events from '@/pages/events'
import feed from '@/pages/feed'
import groups from '@/pages/groups'
import index from '@/pages/index'
import profile from '@/pages/profile'
import relationships from '@/pages/relationships'

firebase.initializeApp({
  apiKey: 'AIzaSyDpRbQe67nfP2HTxkThxhY2Fk-ru0x2aus',
  authDomain: 'littleman-8f289.firebaseapp.com',
  databaseURL: 'https://littleman-8f289.firebaseio.com',
  storageBucket: 'littleman-8f289.appspot.com',
  messagingSenderId: '363642054727'
})

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    // create profile. on server.
  } else {
    firebase.auth().signInAnonymously()
  }
})

Vue.prototype.$bus = new Vue({})

Vue.use(VueRouter)
Vue.config.productionTip = false
const routes = [
  { path: '/', component: index },
  { path: '/events', component: events },
  { path: '/feed', component: feed },
  { path: '/groups', component: groups },
  { path: '/profile', component: profile },
  { path: '/relationships', component: relationships }
]
const router = new VueRouter({
  routes,
  mode: 'history'
})

/* eslint-disable no-new */
new Vue({
  el: '#social_network',
  router,
  render: h => h(app)
})
