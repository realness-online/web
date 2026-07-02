import { createWebHistory, createRouter } from 'vue-router'
import { current_user, me } from '@/utils/serverless'
import { valid_name } from '@/utils/valid-name'

const routes = [
  { path: '/', component: () => import('@/views/Thoughts') },
  {
    path: '/about',
    component: () => import('@/views/About'),
    meta: { support: true }
  },
  {
    path: '/docs',
    component: () => import('@/views/Documentation'),
    meta: { support: true }
  },
  { path: '/sign-on', redirect: '/account' },
  {
    path: '/pricing',
    component: () => import('@/views/Pricing'),
    meta: { support: true }
  },
  { path: '/license', redirect: '/pricing' },
  { path: '/sponsor', redirect: '/pricing' },
  {
    path: '/terms',
    component: () => import('@/views/Terms'),
    meta: { support: true }
  },
  {
    path: '/privacy',
    component: () => import('@/views/Privacy'),
    meta: { support: true }
  },
  {
    path: '/account',
    component: () => import('@/views/Account'),
    meta: { support: true }
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

router.beforeEach(to => {
  if (to.path !== '/') return true
  if (!current_user.value) return true
  if (valid_name(me.value?.name)) return true
  return {
    path: '/account',
    query: { ...to.query, next: to.fullPath }
  }
})

export default router
