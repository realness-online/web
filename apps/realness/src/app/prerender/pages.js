export const site_origin = 'https://realness.online'
export const site_name = 'Realness Online'
export const default_og_image = `${site_origin}/og.jpg`

export const og_image_headline = 'Realness Online'
export const og_image_subhead = 'Rotoscope photos into layered SVG posters'
export const og_image_cta = 'Make some posters today'
export const og_image_alt = `${og_image_headline} — ${og_image_cta}`
export const og_image_type = 'image/jpeg'

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
    path: '/prints',
    title: 'Realness Online - Prints',
    description:
      'Hand-finished prints of Realness posters - finished by hand and shipped to you. Every print covers the same area, so a tall poster does not shout over a wide one.',
    og_title: 'Realness Online - Prints'
  },
  {
    path: '/pricing/endorse',
    title: 'Realness Online - Pricing - Endorse',
    description:
      'Endorse Realness: photo to poster, mosaics, shadow layers, SVG, PNG, PSD, video, and GLB export, the Thoughts feed, and commercial use.',
    og_title: 'Realness Online - Pricing - Endorse'
  },
  {
    path: '/pricing/teams',
    title: 'Realness Online - Pricing - Teams',
    description:
      'Realness for teams: run an instance for your studio, family, or circle. One moderator, shared tools, and one price for the group, never per seat.',
    og_title: 'Realness Online - Pricing - Teams'
  },
  {
    path: '/pricing/enterprise',
    title: 'Realness Online - Pricing - Enterprise',
    description:
      'Realness for companies and institutions: many communities, governance that scales, and hosting for large groups. One price, never per seat.',
    og_title: 'Realness Online - Pricing - Enterprise'
  },
  {
    path: '/license',
    title: 'Realness Online - License',
    description:
      'Realness is free software under the GNU GPL version 2. Copyright notice, no warranty, corresponding source, and the full license text.',
    og_title: 'Realness Online - License'
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
