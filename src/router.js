import Vue from 'vue';
import Router from 'vue-router';
import Events from '@/views/Events'
import Feed from '@/views/Feed'
import Where from '@/views/Where'
import Account from '@/views/Account'
import Index from '@/views/Index'
import Profile from '@/views/Profile'
import Avatar from '@/views/Avatar'
import Relations from '@/views/Relations'
import Phonebook from '@/views/PhoneBook'

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
    { path: '/phonebook', component: PhoneBook },
    { path: '/profile', component: Profile },
    { path: '/account',
      name: 'account',
      component: () => import(/* webpackChunkName: "account" */ './views/Account.vue')
    },
    { path: '/:phone_number/avatar', component: avatar },
    { path: '/:phone_number', component: profile }
  ]
})
