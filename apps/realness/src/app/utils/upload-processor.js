const compress_html = html => {
  const compressor_worker = new Worker('/compressor.worker.js')
  return new Promise((resolve, reject) => {
    compressor_worker.onmessage = ({ data: result }) => {
      compressor_worker.terminate()
      if (result.error) reject(new Error(result.error))
      else resolve(result.blob)
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
      if (result.error) reject(new Error(result.error))
      else resolve(result.html)
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
  const html_string = items.outerHTML ?? items
  const compressed = await compress_html(html_string)
  const content_hash = await create_hash(html_string)

  const language = navigator.language?.split('-')[0].toLowerCase()

  return {
    compressed,
    metadata: {
      cacheControl: 'private, max-age=18000',
      contentType: 'text/html; charset=utf-8',
      contentEncoding: 'gzip',
      contentDisposition: 'inline',
      contentLanguage: language,
      customMetadata: {
        hash: content_hash,
        fullLocale: navigator.language
      }
    }
  }
}
