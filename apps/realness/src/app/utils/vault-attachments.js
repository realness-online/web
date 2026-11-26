/**
 * A note's images that sit beside it in the vault. An image tag cannot send
 * the reader's token, so each one loads through fetch and shows as a blob.
 */

/**
 * The image source names a file beside the note: no scheme, no root, no hash.
 * @param {string} src
 */
export const is_beside = src =>
  Boolean(src) && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(src)

/**
 * The note's html with each image beside it swapped for a blob URL.
 * @param {string} html
 * @param {string} itemid the note's itemid
 * @param {string | null} token
 * @returns {Promise<{ html: string, urls: string[] }>}
 */
export const with_attachments = async (html, itemid, token) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const images = [...doc.querySelectorAll('img[src]')].filter(img =>
    is_beside(img.getAttribute('src') ?? '')
  )
  const urls = await Promise.all(
    images.map(async img => {
      const name = img.getAttribute('src') ?? ''
      const response = await fetch(
        `/v1/vault/attachment?itemid=${encodeURIComponent(itemid)}&name=${encodeURIComponent(name)}`,
        { headers: token ? { authorization: `Bearer ${token}` } : {} }
      )
      if (!response.ok) return ''
      const url = URL.createObjectURL(await response.blob())
      img.setAttribute('src', url)
      return url
    })
  )
  return { html: doc.body.innerHTML, urls: urls.filter(Boolean) }
}
