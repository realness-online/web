import { createWebHistory, createRouter } from 'vue-router'

const routes = [
  { path: '/', component: () => import('@/views/Thoughts') },
  { path: '/relations', component: () => import('@/views/Relations') },
  { path: '/phonebook', component: () => import('@/views/PhoneBook') },
  { path: '/about', component: () => import('@/views/About') },
  { path: '/:phone_number', component: () => import('@/views/Profile') }
]
const router = createRouter({
  history: createWebHistory(),
  routes
})
export default router
