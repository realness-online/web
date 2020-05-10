import Vue from 'vue'
import Router from 'vue-router'
import Events from '@/views/Events'
import Feed from '@/views/Feed'
import Posters from '@/views/Posters'
import Account from '@/views/Account'
import Navigation from '@/views/Navigation'
import Profile from '@/views/Profile'
import Relations from '@/views/Relations'
import PhoneBook from '@/views/PhoneBook'
import Admin from '@/views/Admin'

Vue.use(Router)
export default new Router({
  mode: 'history',
  el: '#loading-realness',
  base: process.env.BASE_URL,
  routes: [
    { path: '/', component: Navigation },
    { path: '/events', component: Events },
    { path: '/feed', component: Feed },
    { path: '/posters', component: Posters },
    { path: '/relations', component: Relations },
    { path: '/phone-book', component: PhoneBook },
    { path: '/profile', component: Profile },
    { path: '/account', component: Account },
    { path: '/admin', component: Admin },
    { path: '/:phone_number', component: Profile, name: 'view-profile' }
  ]
})
