import { createWebHistory, createRouter } from 'vue-router'

const routes = [
  { path: '/', component: () => import('@/views/Navigation') },
  { path: '/posters', component: () => import('@/views/Posters') },
  { path: '/thoughts', component: () => import('@/views/Thoughts') },
  { path: '/events', component: () => import('@/views/Events') },
  { path: '/relations', component: () => import('@/views/Relations') },
  { path: '/phonebook', component: () => import('@/views/PhoneBook') },
  { path: '/profile', component: () => import('@/views/Profile') },
  { path: '/statements', component: () => import('@/views/Statements') },
  { path: '/about', component: () => import('@/views/About') },
  { path: '/:phone_number', component: () => import('@/views/Profile') }
]
const router = createRouter({
  history: createWebHistory(),
  routes
})
export default router
