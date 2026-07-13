import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import {
  create_hash,
  decompress_html,
  prepare_upload_html
} from '@/utils/upload-processor'

describe('@/utils/upload-processor', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { language: 'en-US' })
  })

  it('create_hash returns stable base64 sha-256', async () => {
    const a = await create_hash('hello')
    const b = await create_hash('hello')
    const c = await create_hash('world')

    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(typeof a).toBe('string')
  })

  it('prepare_upload_html compresses string html via worker', async () => {
    class FakeWorker {
      constructor() {
        setTimeout(() => {
          this.onmessage?.({ data: { blob: new Blob(['gz']) } })
        }, 0)
      }
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker)

    const result = await prepare_upload_html('<p>x</p>')

    expect(result.compressed).toBeInstanceOf(Blob)
    expect(result.metadata.contentType).toBe('text/html; charset=utf-8')
    expect(result.metadata.contentEncoding).toBe('deflate')
    expect(result.metadata.contentLanguage).toBe('en')
    expect(result.metadata.customMetadata.hash).toBeTruthy()
  })

  it('decompress_html resolves html from worker response', async () => {
    class FakeWorker {
      constructor() {
        setTimeout(() => {
          this.onmessage?.({ data: { html: '<p>restored</p>' } })
        }, 0)
      }
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker)

    const html = await decompress_html(new Blob(['gz']))

    expect(html).toBe('<p>restored</p>')
  })

  it('decompress_html rejects when worker errors', async () => {
    class FailingWorker {
      constructor() {
        setTimeout(() => {
          this.onerror?.(new Error('worker failed'))
        }, 0)
      }
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', FailingWorker)

    await expect(decompress_html(new Blob(['gz']))).rejects.toBeTruthy()
  })

  it('decompress_html rejects instead of hanging when the worker replies with an error message', async () => {
    class ErrorReplyWorker {
      constructor() {
        setTimeout(() => {
          this.onmessage?.({ data: { error: 'corrupt data' } })
        }, 0)
      }
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', ErrorReplyWorker)

    await expect(decompress_html(new Blob(['gz']))).rejects.toThrow(
      'corrupt data'
    )
  })

  it('prepare_upload_html accepts HTMLElement outerHTML', async () => {
    const worker_ctor = vi.fn().mockImplementation(function FakeWorker() {
      setTimeout(() => {
        this.onmessage?.({ data: { blob: new Blob(['c']) } })
      }, 0)
    })
    worker_ctor.prototype.postMessage = vi.fn()
    worker_ctor.prototype.terminate = vi.fn()
    vi.stubGlobal('Worker', worker_ctor)

    const el = document.createElement('motion.div')
    el.innerHTML = '<span>hi</span>'

    await prepare_upload_html(el)

    expect(worker_ctor).toHaveBeenCalledWith('/compressor.worker.js')
  })
})
