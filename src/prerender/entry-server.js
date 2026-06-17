import './prerender-globals.js'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import PrerenderShell from '@/prerender/prerender-shell.vue'
import About from '@/views/About.vue'
import Documentation from '@/views/Documentation.vue'
import License from '@/views/License.vue'
import { prerender_routes } from '@/prerender/pages.js'

export { prerender_routes }

const stub = { template: '<div />' }

const routes = [
  { path: '/', component: stub },
  { path: '/about', component: About },
  { path: '/docs', component: Documentation },
  { path: '/pricing', component: License },
  { path: '/sign-on', redirect: '/account' },
  { path: '/account', component: stub }
]

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
export const render = async url => {
  const app = createSSRApp(PrerenderShell)
  const router = createRouter({
    history: createMemoryHistory(),
    routes
  })
  app.use(router)
  app.provide('documentation', { value: { show: () => {} } })
  app.provide('set_working', () => {})
  await router.push(url)
  await router.isReady()
  return renderToString(app)
}
