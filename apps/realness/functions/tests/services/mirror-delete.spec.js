import { describe, it, expect, vi } from 'vitest'
import { mirror_delete } from '#services/mirror-delete.js'

const fixture = () => {
  const remove = vi.fn(async () => {})
  const bucket = { file: vi.fn(() => ({ delete: remove })) }
  const options = {
    bucket, name: 'people/+123/posters/123.html.gz',
    target_generation: '90071992547409931', target_metageneration: '2'
  }
  return { remove, bucket, options }
}

describe('mirror_delete', () => {
  it('guards the live counterpart without rounding its generation', async () => {
    const { options, bucket, remove } = fixture()
    await mirror_delete(options)
    expect(bucket.file).toHaveBeenCalledWith('people/+123/posters/123.html')
    expect(remove).toHaveBeenCalledWith({
      ifGenerationMatch: options.target_generation, ifMetagenerationMatch: '2'
    })
  })

  it.each([404, 412, 403, 503])('surfaces storage error %s for reconciliation', async code => {
    const { options, remove } = fixture()
    const error = Object.assign(new Error('storage failure'), { code })
    remove.mockRejectedValue(error)
    await expect(mirror_delete(options)).rejects.toBe(error)
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it.each(['0', undefined, '', '-1'])('refuses an unguarded delete: %s', async generation => {
    const { options, bucket } = fixture()
    await expect(mirror_delete({ ...options, target_generation: generation })).rejects.toThrow()
    expect(bucket.file).not.toHaveBeenCalled()
  })

  it('refuses missing metadata guards', async () => {
    const { options, bucket } = fixture()
    await expect(mirror_delete({ ...options, target_metageneration: undefined })).rejects.toThrow()
    expect(bucket.file).not.toHaveBeenCalled()
  })

  it('refuses unrelated files', async () => {
    const { options, bucket } = fixture()
    await expect(mirror_delete({ ...options, name: 'other/a.html' })).rejects.toThrow()
    expect(bucket.file).not.toHaveBeenCalled()
  })
})
