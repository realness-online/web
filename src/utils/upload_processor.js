export const compress_html = html => {
  const compressor_worker = new Worker('/compressor.worker.js')
  return new Promise((resolve, reject) => {
    compressor_worker.onmessage = ({ data: result }) => {
      compressor_worker.terminate()
      resolve(result.blob)
    }
    compressor_worker.onerror = error => {
      compressor_worker.terminate()
      reject(error)
    }
    compressor_worker.postMessage({
      route: 'compress:html',
      html
    })
  })
}
export const create_hash = async (data, algorithm = 'SHA-256') => {
  const encoder = new TextEncoder()
  const data_buffer = encoder.encode(data)
  const hash_buffer = await crypto.subtle.digest(algorithm, data_buffer)
  return btoa(String.fromCharCode(...new Uint8Array(hash_buffer)))
}

export const decompress_html = compressed => {
  const compressor_worker = new Worker('/compressor.worker.js')

  return new Promise((resolve, reject) => {
    compressor_worker.onmessage = ({ data: result }) => {
      compressor_worker.terminate()
      resolve(result.html)
    }
    compressor_worker.onerror = error => {
      compressor_worker.terminate()
      reject(error)
    }
    compressor_worker.postMessage({
      route: 'decompress:html',
      compressed
    })
  })
}

export const prepare_upload_html = async items => {
  // Convert HTML element to string if needed
  const html_string = items instanceof HTMLElement ? items.outerHTML : items
  const compressed = await compress_html(html_string)
  const content_hash = await create_hash(html_string)

  // Get language code in correct format (ISO 639-1)
  // Example: 'en-US' -> 'en', 'es-ES' -> 'es'
  const language = navigator.language?.split('-')[0].toLowerCase()

  return {
    compressed,
    metadata: {
      cacheControl: 'private, max-age=18000',
      contentType: 'text/html; charset=utf-8',
      contentEncoding: 'deflate',
      contentDisposition: 'inline',
      contentLanguage: language, // Using ISO 639-1 language code
      customMetadata: {
        hash: content_hash,
        fullLocale: navigator.language // Store full locale in custom metadata
      }
    }
  }
}
