import './prerender-globals.js'
import { createSSRApp as create_ssr_app } from 'vue'
import { renderToString as render_to_string } from 'vue/server-renderer'
import {
  createMemoryHistory as create_memory_history,
  createRouter as create_router
} from 'vue-router'
import PrerenderShell from '@/prerender/prerender-shell.vue'
import About from '@/views/About.vue'
import Documentation from '@/views/Documentation.vue'
import Prints from '@/views/Prints.vue'
import Print from '@/views/Print.vue'
import Pricing from '@/views/Pricing.vue'
import Terms from '@/views/Terms.vue'
import License from '@/views/License.vue'
import { prerender_routes } from '@/prerender/pages.js'

export { prerender_routes }

const stub = { template: '<div />' }

const routes = [
  { path: '/', component: stub },
  { path: '/about', component: About, meta: { support: true } },
  { path: '/docs', component: Documentation, meta: { support: true } },
  { path: '/prints', component: Prints, meta: { support: true } },
  { path: '/prints/:id', component: Print, meta: { support: true } },
  { path: '/pricing', component: Pricing, meta: { support: true } },
  { path: '/pricing/:tier', component: Pricing, meta: { support: true } },
  { path: '/license', component: License, meta: { support: true } },
  { path: '/terms', component: Terms, meta: { support: true } },
  { path: '/privacy', redirect: '/terms#privacy-policy' },
  { path: '/changelog', redirect: '/docs#changelog' },
  { path: '/sign-on', component: stub },
  { path: '/account', component: stub }
]

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
export const render = async url => {
  const app = create_ssr_app(PrerenderShell)
  const router = create_router({
    history: create_memory_history(),
    routes
  })
  app.use(router)
  app.provide('documentation', { value: { show: () => {} } })
  app.provide('set_working', () => {})
  await router.push(url)
  await router.isReady()
  return render_to_string(app)
}
