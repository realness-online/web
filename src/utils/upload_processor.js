export const compress_data = (data, filename = 'data') => {
  const compressor_worker = new Worker('/compressor.worker.js')
  return new Promise((resolve, reject) => {
    compressor_worker.onmessage = ({ data: result }) => {
      compressor_worker.terminate()
      resolve(result)
    }
    compressor_worker.onerror = (error) => {
      compressor_worker.terminate()
      reject(error)
    }
    compressor_worker.postMessage({
      route: 'compress:vector',
      data: { html: data, filename }
    })
  })
}
export const create_hash = async (data, algorithm = 'SHA-256') => {
  const encoder = new TextEncoder()
  const data_buffer = encoder.encode(data)
  const hash_buffer = await crypto.subtle.digest(algorithm, data_buffer)
  return btoa(String.fromCharCode(...new Uint8Array(hash_buffer)))
}

export const decompress_data = (data) => {
  const compressor_worker = new Worker('/compressor.worker.js')
  return new Promise((resolve, reject) => {
    compressor_worker.onmessage = ({ data: result }) => {
      compressor_worker.terminate()
      resolve(result)
    }
    compressor_worker.onerror = (error) => {
      compressor_worker.terminate()
      reject(error)
    }
    compressor_worker.postMessage({
      route: 'decompress:data',
      data: {
        compressed: data
      }
    })
  })
}


export const prepare_upload_data = async (items, path) => {
  const data = await compress_data(items, path)
  const content_hash = await create_hash(items)
  const md5_hash = await create_hash(items, 'MD5')

  return {
    data,
    content_hash,
    md5_hash,
    metadata: {
      cacheControl: 'private, max-age=18000',
      contentType: 'text/html; charset=utf-8',
      contentLanguage: navigator.language,
      contentEncoding: 'gzip',
      contentDisposition: 'inline',
      md5Hash: md5_hash,
      customMetadata: {
        ETag: `"${content_hash}"`
      }
    }
  }
}
