/** @typedef {import('@/types').Id} Id */

/**
 * File input helpers: camera capture, file picker, clipboard, type filtering.
 *
 * @param {import('vue').Ref<HTMLInputElement | null>} image_picker
 * @param {Function} add_to_queue
 */
export const use_file_input = (image_picker, add_to_queue) => {
  const select_photo = () => {
    if (!image_picker.value) return
    image_picker.value.removeAttribute('capture')
    image_picker.value.setAttribute('multiple', '')
    image_picker.value.click()
  }

  const open_selfie_camera = () => {
    if (!image_picker.value) return
    image_picker.value.setAttribute('capture', 'user')
    image_picker.value.click()
  }

  const open_camera = () => {
    if (!image_picker.value) return
    image_picker.value.setAttribute('capture', 'environment')
    image_picker.value.click()
  }

  const accepted_types = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/svg+xml'
  ]

  const extension_by_type = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/svg+xml': 'svg'
  }

  const accepted_extensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.bmp',
    '.tif',
    '.tiff',
    '.avif',
    '.heic',
    '.heif',
    '.svg'
  ]

  /**
   * @param {File} file
   * @returns {boolean}
   */
  const is_supported_image_file = file => {
    const file_name = file.name.toLowerCase()
    return (
      accepted_types.some(type => file.type === type) ||
      accepted_extensions.some(extension => file_name.endsWith(extension))
    )
  }

  /**
   * @param {File[]} files
   * @returns {Promise<boolean>}
   */
  const queue_supported_files = async files => {
    const image_files = files.filter(is_supported_image_file)
    if (image_files.length === 0) return false
    await add_to_queue(image_files)
    return true
  }

  /**
   * Convert clipboard items into supported files and queue them.
   * @param {ClipboardItem[]} clipboard_items
   * @returns {Promise<boolean>}
   */
  const queue_supported_clipboard_items = async clipboard_items => {
    const files = (
      await Promise.all(
        clipboard_items.map(async item => {
          const image_type = item.types.find(type =>
            accepted_types.includes(type)
          )
          if (!image_type) return null
          const extension = extension_by_type[image_type]
          if (!extension) return null
          const blob = await item.getType(image_type)
          return new File([blob], `clipboard-${Date.now()}.${extension}`, {
            type: image_type
          })
        })
      )
    ).filter(file => file !== null)
    return queue_supported_files(files)
  }

  const listener = async () => {
    if (!image_picker.value?.files) return
    const files = Array.from(image_picker.value.files)
    if (image_picker.value) {
      image_picker.value.removeAttribute('capture')
      image_picker.value.removeAttribute('multiple')
    }
    if (files.length === 0) return

    await queue_supported_files(files)
    if (image_picker.value) image_picker.value.value = ''
  }

  const v_vectorizer = {
    mounted: input => input.addEventListener('change', listener)
  }

  return {
    select_photo,
    open_selfie_camera,
    open_camera,
    queue_supported_files,
    queue_supported_clipboard_items,
    v_vectorizer
  }
}
