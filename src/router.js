import Vue from 'vue'
import Router from 'vue-router'
import Events from '@/views/Events'
import Feed from '@/views/Feed'
import Where from '@/views/Where'
import Account from '@/views/Account'
import Index from '@/views/Index'
import Profile from '@/views/Profile'
import Relations from '@/views/Relations'
import PhoneBook from '@/views/PhoneBook'

import Growth from '@/views/Growth'

Vue.use(Router)
export default new Router({
  mode: 'history',
  el: '#loading-realness',
  base: process.env.BASE_URL,
  routes: [
    { path: '/', component: Index },
    { path: '/events', component: Events },
    { path: '/feed', component: Feed },
    { path: '/where', component: Where },
    { path: '/relations', component: Relations },
    { path: '/phone-book', component: PhoneBook },
    { path: '/profile', component: Profile },
    { path: '/account', component: Account },
    { path: '/growth', component: Growth },
    { path: '/:phone_number', component: Profile, name: 'view-profile' }
  ]
})
