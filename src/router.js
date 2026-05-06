import { createWebHistory, createRouter } from 'vue-router'
import { current_user } from '@/utils/serverless'

const routes = [
  { path: '/', component: () => import('@/views/Thoughts') },
  { path: '/relations', component: () => import('@/views/Relations') },
  { path: '/phonebook', component: () => import('@/views/PhoneBook') },
  { path: '/about', component: () => import('@/views/About') },
  { path: '/sign-on', component: () => import('@/views/SignOn') },
  { path: '/sponsor', component: () => import('@/views/Sponsor') },
  {
    path: '/account',
    component: () => import('@/views/Account'),
    meta: { requires_auth: true }
  },
  { path: '/:phone_number', component: () => import('@/views/Profile') }
]
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, left: 0 }
  }
})

/* Only redirect when auth is definitively signed-out (`null`). When still
   booting (`undefined`), let the view mount and re-check on its own. */
router.beforeEach(to => {
  if (to.meta?.requires_auth && current_user.value === null)
    return { path: '/sign-on', query: { next: to.fullPath } }
  return true
})

export default router
