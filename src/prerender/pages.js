export const site_origin = 'https://realness.online'
export const site_name = 'Realness Online'
export const default_og_image = `${site_origin}/og.png`

export const home_title =
  'Realness Online — Rotoscope Photos into Layered SVG Posters'
export const home_description =
  'Rotoscope photos into layered SVG posters — mosaics, shadows, and gradients. On-device tracing for artists and communities.'

export const og_image_headline = 'Realness Online'
export const og_image_subhead = 'Rotoscope photos into layered SVG posters'
export const og_image_cta = 'Make some posters today'
export const og_image_alt = `${og_image_headline} — ${og_image_cta}`
export const og_image_type = 'image/png'

/** @typedef {Record<string, unknown>} JsonLdSchema */

/** @type {Array<{ path: string, render_path?: string, canonical?: string, title: string, description: string, og_title: string, og_image?: string, json_ld?: JsonLdSchema | ((page: { description: string, url: string }) => JsonLdSchema) | 'software_application' }>} */
export const prerender_pages = [
  {
    path: '/about',
    title: 'Realness Online - About',
    description:
      'Realness is a rotoscoping tool — trace photos into layered SVG posters with mosaics, shadows, and gradients. On-device tracing for artists, animators, and small communities.',
    og_title: 'Realness Online - About',
    json_ld: 'software_application'
  },
  {
    path: '/docs',
    title: 'Realness Online - Documentation',
    description:
      'How to use Realness: rotoscope photos into layered SVG posters, Thoughts feed, island controls, exports (SVG, PNG, PSD, video, GLB), sync, install, keyboard shortcuts, and changelog.',
    og_title: 'Realness Online - Documentation'
  },
  {
    path: '/pricing',
    title: 'Realness Online - Pricing',
    description:
      'Realness is free to use — but it has a price, if you want one. Separate paid tiers for teams and organizations.',
    og_title: 'Realness Online - Pricing'
  },
  {
    path: '/terms',
    title: 'Realness Online - Terms & Privacy',
    description:
      'Terms of Service and Privacy Policy for Realness — the rotoscoping tool and outsider social network.',
    og_title: 'Realness Online - Terms & Privacy'
  }
]

export const prerender_routes = prerender_pages.map(page => page.path)
