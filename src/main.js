import Vue from 'vue'
import VueRouter from 'vue-router'
import * as firebase from 'firebase/app'
import app from '@/components/application'
import events from '@/pages/events'
import feed from '@/pages/feed'
import groups from '@/pages/groups'
import index from '@/pages/index'
import profile from '@/pages/profile'
import relations from '@/pages/relations'

firebase.initializeApp(process.env.FIREBASE_CONFIG)
Vue.prototype.$bus = new Vue({})
Vue.use(VueRouter)
Vue.config.productionTip = false

const routes = [
  { path: '/', component: index },
  { path: '/events', component: events },
  { path: '/feed', component: feed },
  { path: '/groups', component: groups },
  { path: '/profile', component: profile },
  { path: '/relations', component: relations }
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
