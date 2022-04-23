import { createWebHistory, createRouter } from 'vue-router'
import Events from '@/views/Events'
import Feed from '@/views/Feed'
import Posters from '@/views/Posters'
import Account from '@/views/Account'
import Navigation from '@/views/Navigation'
import Profile from '@/views/Profile'
import Relations from '@/views/Relations'
import PhoneBook from '@/views/PhoneBook'
import Sign_on from '@/views/Sign-on'
import Editor from '@/views/Editor'
import About from '@/views/About'
import Settings from '@/views/Settings'
import Documentation from '@/views/Documentation'
const routes = [
  { path: '/', component: Navigation },
  { path: '/sign-on', component: Sign_on },
  { path: '/events', component: Events },
  { path: '/feed', component: Feed },
  { path: '/posters', component: Posters },
  { path: '/:type/:id/editor', component: Editor },
  { path: '/relations', component: Relations },
  { path: '/phonebook', component: PhoneBook },
  { path: '/profile', component: Profile },
  { path: '/account', component: Account },
  { path: '/about', component: About },
  { path: '/settings', component: Settings },
  { path: '/documentation', component: Documentation },
  { path: '/:phone_number', component: Profile }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
