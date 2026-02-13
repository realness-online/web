import { createWebHistory, createRouter } from 'vue-router'
import Events from '@/views/Events'
import Thoughts from '@/views/Thoughts'
import Posters from '@/views/Posters'
import Statements from '@/views/Statements'
import Navigation from '@/views/Navigation'
import Profile from '@/views/Profile'
import Relations from '@/views/Relations'
import PhoneBook from '@/views/PhoneBook'
import About from '@/views/About'

const routes = [
  { path: '/', component: Navigation },
  { path: '/posters', component: Posters },
  { path: '/thoughts', component: Statements },
  { path: '/events', component: Events },
  { path: '/relations', component: Relations },
  { path: '/phonebook', component: PhoneBook },
  { path: '/profile', component: Profile },
  { path: '/statements', component: Thoughts },
  { path: '/about', component: About },
  { path: '/:phone_number', component: Profile }
]
const router = createRouter({
  history: createWebHistory(),
  routes
})
export default router
