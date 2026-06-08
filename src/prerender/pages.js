export const site_origin = 'https://realness.online'

/** @type {Array<{ path: string, render_path?: string, canonical?: string, title: string, description: string, og_title: string }>} */
export const prerender_pages = [
  {
    path: '/about',
    title: 'Realness Online - About',
    description:
      'Create expressive vector graphics from photos. Realness is an outsider social network built for artists, animators, and communities.',
    og_title: 'Realness Online - About'
  },
  {
    path: '/docs',
    title: 'Realness Online - Documentation',
    description:
      'How to use Realness: posters, thoughts, phonebook, events, sync, exports, and keyboard shortcuts.',
    og_title: 'Realness Online - Documentation'
  },
  {
    path: '/pricing',
    title: 'Realness Online - Pricing',
    description:
      'Realness is free to use. It costs $5, and stays free to use. License plans for small teams and large organizations.',
    og_title: 'Realness Online - Pricing'
  }
]

export const prerender_routes = prerender_pages.map(page => page.path)
