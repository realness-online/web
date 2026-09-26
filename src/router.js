import { createWebHistory, createRouter } from 'vue-router'
import { current_user, me } from '@/utils/serverless'
import { valid_name } from '@/utils/valid-name'
import Thoughts from '@/views/Thoughts'
import { after_sign_on } from '@/utils/after-sign-on'
import { cli_request } from '@/utils/cli-hand-off'

/** Signed in and named: nothing left for the sign-on page to do. */
const signed_on = () => !!current_user.value && valid_name(me.value?.name)

const routes = [
  { path: '/', component: Thoughts },
  {
    path: '/about',
    component: () => import('@/views/About'),
    meta: { support: true }
  },
  {
    path: '/prints',
    component: () => import('@/views/Prints.vue'),
    meta: { support: true }
  },
  {
    path: '/docs',
    component: () => import('@/views/Documentation'),
    meta: { support: true }
  },
  // Sign-on is its own page: arriving always shows the form. A dialog on
  // /account had to be told to open, and missed the cue when you were
  // already there.
  {
    path: '/sign-on',
    component: () => import('@/views/SignOn'),
    meta: { support: true },
    // Already signed on goes where it was headed, unless a terminal on this
    // computer is waiting for the sign-in (`brayness login`).
    beforeEnter: to =>
      signed_on() && !cli_request(to.query) ? after_sign_on(to.query) : true
  },
  { path: '/sign-in', redirect: to => ({ path: '/sign-on', query: to.query }) },
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
    meta: { support: true },
    // Old links carried a `sign-in` flag to open the dialog; send them on.
    beforeEnter: to => {
      if (to.query?.['sign-in'] === undefined) return true
      const query = { ...to.query }
      delete query['sign-in']
      return { path: '/sign-on', query }
    }
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

// Signed in without a name: the sign-on page owns the naming step.
router.beforeEach(to => {
  if (to.path !== '/' && to.path !== '/account') return true
  if (!current_user.value || signed_on()) return true
  return { path: '/sign-on', query: { next: to.fullPath } }
})

export default router
