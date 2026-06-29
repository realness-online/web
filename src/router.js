import { createWebHistory, createRouter } from 'vue-router'

const routes = [
  { path: '/', component: () => import('@/views/Thoughts') },
  { path: '/about', component: () => import('@/views/About') },
  { path: '/docs', component: () => import('@/views/Documentation') },
  { path: '/sign-on', redirect: '/account' },
  { path: '/pricing', component: () => import('@/views/Pricing') },
  { path: '/license', redirect: '/pricing' },
  { path: '/sponsor', redirect: '/pricing' },
  { path: '/terms', component: () => import('@/views/Terms') },
  { path: '/privacy', component: () => import('@/views/Privacy') },
  {
    path: '/account',
    component: () => import('@/views/Account')
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

export default router
