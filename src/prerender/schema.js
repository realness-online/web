import { default_og_image, site_origin } from './pages.js'

/**
 * @param {{ description: string, url: string }} page
 */
export const software_application_schema = page => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Realness',
  url: page.url,
  image: default_og_image,
  description: page.description,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requires JavaScript',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  },
  author: {
    '@type': 'Organization',
    name: 'Realness',
    url: site_origin
  }
})
