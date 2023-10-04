import { createWebHistory, createRouter } from 'vue-router'
import Events from '@/views/Events'
import Thoughts from '@/views/Thoughts'
import Posters from '@/views/Posters'
import Statements from '@/views/Statements'
import Navigation from '@/views/Navigation'
import Profile from '@/views/Profile'
import Relations from '@/views/Relations'
import PhoneBook from '@/views/PhoneBook'
import Sign_on from '@/views/Sign-on'
import Editor from '@/views/Editor'
import About from '@/views/About'
import Camera from '@/views/Camera'
import Settings from '@/views/Settings'
import Documentation from '@/views/Documentation'
const routes = [
  { path: '/', component: Navigation },
  { path: '/posters', component: Posters },
  { path: '/posters/:id/editor', component: Editor },
  { path: '/thoughts', component: Thoughts },
  { path: '/camera', component: Camera },
  { path: '/sign-on', component: Sign_on },
  { path: '/events', component: Events },
  { path: '/relations', component: Relations },
  { path: '/phonebook', component: PhoneBook },
  { path: '/profile', component: Profile },
  { path: '/statements', component: Statements },
  { path: '/settings', component: Settings },
  { path: '/about', component: About },
  { path: '/documentation', component: Documentation },
  { path: '/:phone_number', component: Profile }
]
const router = createRouter({
  history: createWebHistory(),
  routes
})
export default router
