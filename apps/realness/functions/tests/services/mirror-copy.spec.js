import { describe, it, expect, vi } from 'vitest'
import { mirror_copy } from '#services/mirror-copy.js'

const fixture = () => {
  const metadata = { generation: '90071992547409933' }
  const request = vi.fn(async () => ({ done: true, resource: metadata }))
  const source = {
    request: (options, done) => request(options).then(data => done(null, data), done)
  }
  const bucket = { name: 'test-bucket', file: vi.fn(() => source) }
  const options = {
    bucket, name: 'people/+123/posters/123.html.gz',
    source_generation: '90071992547409931', source_metageneration: '2',
    target_generation: '90071992547409932', target_metageneration: '3'
  }
  const guards = {
    ifSourceGenerationMatch: options.source_generation,
    ifSourceMetagenerationMatch: '2',
    ifGenerationMatch: options.target_generation, ifMetagenerationMatch: '3'
  }
  return { options, request, metadata, guards }
}

describe('mirror_copy', () => {
  it('guards both byte and metadata revisions in the actual request', async () => {
    const { options, request, metadata, guards } = fixture()
    expect(await mirror_copy(options)).toBe(metadata)
    expect(options.bucket.file).toHaveBeenCalledWith(options.name)
    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      uri: '/rewriteTo/b/test-bucket/o/people%2F%2B123%2Fposters%2F123.html',
      json: {}, qs: guards
    })
  })

  it('repeats all guards across rewrite-token requests', async () => {
    const { options, request, guards, metadata } = fixture()
    request.mockResolvedValueOnce({ done: false, rewriteToken: 'next' })
    expect(await mirror_copy(options)).toBe(metadata)
    expect(request.mock.calls[1][0].qs).toEqual({ ...guards, rewriteToken: 'next' })
  })

  it('creates only if the counterpart is still absent', async () => {
    const { options, request } = fixture()
    await mirror_copy({ ...options, target_generation: '0', target_metageneration: undefined })
    expect(request.mock.calls[0][0].qs).toEqual({
      ifSourceGenerationMatch: options.source_generation,
      ifSourceMetagenerationMatch: '2', ifGenerationMatch: '0'
    })
  })

  it.each([404, 412, 403, 503])('surfaces storage error %s without blind retry', async code => {
    const { options, request } = fixture()
    const error = Object.assign(new Error('storage failure'), { code })
    request.mockRejectedValue(error)
    await expect(mirror_copy(options)).rejects.toBe(error)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each([
    { name: 'other/file.html' }, { source_generation: '0' },
    { source_metageneration: undefined }, { target_generation: undefined },
    { target_metageneration: undefined }, { target_generation: '-1' },
    { source_generation: 123 }
  ])('refuses an unguarded operation: %j', async override => {
    const { options, request } = fixture()
    await expect(mirror_copy({ ...options, ...override })).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })

  it('rejects incomplete responses and stalled tokens', async () => {
    const { options, request } = fixture()
    request.mockResolvedValue({})
    await expect(mirror_copy(options)).rejects.toThrow('did not complete')
    request.mockResolvedValue({ rewriteToken: 'same' })
    await expect(mirror_copy(options)).rejects.toThrow('did not complete')
  })
})
