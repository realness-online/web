/**
 * @fileoverview Digging images out of a paste. A clipboard can carry the same
 * picture in several shapes, so this walks them cheapest first: real files,
 * then file-flavoured items, then the data: URLs an <img> tag leaves behind
 * when the copy came from a web page.
 */

/**
 * @param {DataTransferItem} item
 * @returns {Promise<string>}
 */
const item_as_string = item =>
  new Promise(resolve => {
    item.getAsString(value => resolve(value || ''))
  })

/**
 * @param {string} data_url
 * @returns {Promise<File|null>} Null when the URL is not an image, or unreadable
 */
const data_url_to_file = async data_url => {
  if (!data_url.startsWith('data:image/')) return null
  try {
    const response = await fetch(data_url)
    const blob = await response.blob()
    const mime = blob.type || 'image/png'
    const extension = mime.split('/')[1] || 'png'
    return new File([blob], `clipboard-${Date.now()}.${extension}`, {
      type: mime
    })
  } catch {
    return null
  }
}

/**
 * @param {DataTransferItem[]} items
 * @returns {Promise<File[]>} Images carried as data: URLs inside pasted html
 */
const files_from_html = async items => {
  const html_item = items.find(
    item => item.kind === 'string' && item.type === 'text/html'
  )
  if (!html_item) return []
  const html = await item_as_string(html_item)
  if (!html) return []

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const sources = Array.from(doc.querySelectorAll('img'))
    .map(img => img.getAttribute('src') || '')
    .filter(src => src.startsWith('data:image/'))
  if (sources.length === 0) return []

  const converted = await Promise.all(sources.map(data_url_to_file))
  return converted.filter(file => file instanceof File)
}

/**
 * @param {ClipboardEvent} event
 * @returns {Promise<File[]>} Empty when the paste carried no image
 */
export const get_clipboard_files = async event => {
  const files = Array.from(event.clipboardData?.files || [])
  if (files.length > 0) return files

  const items = Array.from(event.clipboardData?.items || [])
  const image_files = items
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(file => file instanceof File)
  if (image_files.length > 0) return image_files

  return await files_from_html(items)
}
