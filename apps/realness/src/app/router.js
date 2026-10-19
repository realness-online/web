import {
  createWebHistory as create_web_history,
  createRouter as create_router
} from 'vue-router'
import { watch } from 'vue'
import { current_user, me } from '@/utils/serverless'
import { valid_name } from '@/utils/valid-name'
import Thoughts from '@/views/Thoughts'
import { after_sign_on } from '@/utils/after-sign-on'
import { cli_request } from '@/utils/cli-hand-off'

/** Signed in and named: nothing left for the sign-on page to do. */
const signed_on = () => !!current_user.value && valid_name(me.value?.name)

/** The signed-in user once Firebase has restored the session; null if none.
    A page load starts at undefined, which means not known yet. */
const settled_user = () => {
  if (current_user.value !== undefined) return current_user.value
  return new Promise(resolve => {
    const stop = watch(current_user, user => {
      if (user === undefined) return
      stop()
      resolve(user)
    })
  })
}

/** Signed out: sign on first, then come back. */
const signed_in_first = async to =>
  (await settled_user())
    ? true
    : { path: '/sign-on', query: { next: to.fullPath } }

const routes = [
  { path: '/', component: Thoughts },
  {
    path: '/pay',
    component: () => import('@/views/Pay'),
    meta: { support: true },
    beforeEnter: signed_in_first
  },
  {
    path: '/admin',
    component: () => import('@/views/LoopsAdmin'),
    meta: { support: true },
    beforeEnter: signed_in_first
  },
  {
    path: '/terminal',
    component: () => import('@/views/Terminal'),
    meta: { session: true },
    beforeEnter: signed_in_first
  },
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
    path: '/prints/:id',
    component: () => import('@/views/Print.vue'),
    meta: { support: true }
  },
  {
    path: '/docs',
    component: () => import('@/views/Documentation'),
    meta: { support: true }
  },
  {
    path: '/sign-on',
    component: () => import('@/views/SignOn'),
    meta: { support: true },
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
    path: '/keys',
    component: () => import('@/views/Keys'),
    meta: { support: true }
  },
  {
    path: '/poster-driver',
    component: () => import('@/views/PosterDriver'),
    meta: { support: true }
  },
  { path: '/:phone_number', component: () => import('@/views/Profile') }
]
const router = create_router({
  history: create_web_history(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }

    if (to.path.startsWith('/pricing') && from.path.startsWith('/pricing'))
      return false

    return new Promise(resolve => {
      requestAnimationFrame(() => resolve({ top: 0 }))
    })
  }
})

router.beforeEach(to => {
  if (to.path !== '/' && to.path !== '/account') return true
  if (!current_user.value || signed_on()) return true
  return { path: '/sign-on', query: { next: to.fullPath } }
})

export default router
