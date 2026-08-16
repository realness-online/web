import { createWebHistory, createRouter } from 'vue-router'
import { current_user, me } from '@/utils/serverless'
import { valid_name } from '@/utils/valid-name'
import Thoughts from '@/views/Thoughts'

const routes = [
  { path: '/', component: Thoughts },
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
  // Sign-on is a dialog on the account page, not a page of its own. The
  // `sign-in` flag opens it on arrival so deep links still land in the flow.
  {
    path: '/sign-on',
    redirect: to => ({
      path: '/account',
      query: { ...to.query, 'sign-in': '' }
    })
  },
  {
    path: '/pricing',
    redirect: '/pricing/endorse',
    meta: { support: true }
  },
  {
    path: '/pricing/:tier',
    component: () => import('@/views/Pricing'),
    meta: { support: true }
  },
  {
    path: '/license',
    component: () => import('@/views/License'),
    meta: { support: true }
  },
  { path: '/sponsor', redirect: '/pricing' },
  {
    path: '/terms',
    component: () => import('@/views/Terms'),
    meta: { support: true }
  },
  { path: '/privacy', redirect: '/terms#privacy-policy' },
  { path: '/changelog', redirect: '/docs#changelog' },
  {
    path: '/account',
    component: () => import('@/views/Account'),
    meta: { support: true }
  },
  {
    path: '/colors',
    component: () => import('@/views/Colors'),
    meta: { support: true }
  },
  {
    path: '/og-candidates',
    component: () => import('@/views/OgCandidates'),
    meta: { support: true }
  },
  {
    path: '/poster-driver',
    component: () => import('@/views/PosterDriver'),
    meta: { support: true }
  },
  { path: '/:phone_number', component: () => import('@/views/Profile') }
]
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }

    // A tier swap is a card swap, not a new page.
    if (to.path.startsWith('/pricing') && from.path.startsWith('/pricing'))
      return false

    // Defer so the scroll fires after the page paints — some mobile
    // browsers need the extra frame for scrollTo to take effect.
    return new Promise(resolve => {
      requestAnimationFrame(() => resolve({ top: 0 }))
    })
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
