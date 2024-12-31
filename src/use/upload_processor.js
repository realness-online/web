import { onUnmounted as unmounted } from 'vue'

export const upload_processor = () => {
 const compressor_worker = new Worker('/compressor.worker.js')


  const compress_data = (data, filename = 'data') => {
    return new Promise((resolve, reject) => {
      compressor_worker.onmessage = ({ data: result }) => {
        resolve(result)
      }
      compressor_worker.onerror = (error) => {
        reject(error)
      }

      compressor_worker.postMessage({
        route: 'compress:vector',
        data: {
          html: data,
          filename
        }
      })
    })
  }

  const decompress_data = (data) => {
    return new Promise((resolve, reject) => {
      compressor_worker.onmessage = ({ data: result }) => {
        resolve(result)
      }
      compressor_worker.onerror = (error) => {
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

  const create_hash = async (data, algorithm = 'SHA-256') => {
    const encoder = new TextEncoder()
    const data_buffer = encoder.encode(data)
    const hash_buffer = await crypto.subtle.digest(algorithm, data_buffer)
    return btoa(String.fromCharCode(...new Uint8Array(hash_buffer)))
  }

  const prepare_upload_data = async (data, filename) => {
    const compressed_data = await compress_data(data, filename)
    const content_hash = await create_hash(data)
    const md5_hash = await create_hash(data, 'MD5')

    return {
      data: compressed_data,
      content_hash,
      md5_hash
    }
  }

  unmounted(() => {
    if (vector_worker) {
      compressor_worker.terminate()
    }
  })

  return {
    compress_data,
    decompress_data,
    create_hash,
    prepare_upload_data
  }
}
