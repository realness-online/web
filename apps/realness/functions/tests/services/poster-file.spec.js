import { describe, it, expect, vi, beforeEach } from 'vitest'
import { poster_file } from '#services/sale.js'

const { bucket, objects } = vi.hoisted(() => ({
  bucket: { file: vi.fn(), getFiles: vi.fn() },
  objects: new Map()
}))
vi.mock('#utils/firebase.js', () => ({ bucket }))

const prefix = 'people/+123/posters/'
const id = '/+123/posters/456'

beforeEach(() => {
  objects.clear()
  bucket.file.mockReset()
  bucket.file.mockImplementation(name => ({
    name,
    exists: async () => [objects.has(name)]
  }))
  bucket.getFiles.mockReset()
  bucket.getFiles.mockImplementation(async () => [[
    ...objects.keys()
  ].map(name => ({ name }))])
})

describe('poster_file transition', () => {
  it.each(['.html.gz', '.html'])('reads a live %s poster', async suffix => {
    const name = `${prefix}456${suffix}`
    objects.set(name, true)
    expect((await poster_file(id)).name).toBe(name)
    expect(bucket.getFiles).not.toHaveBeenCalled()
  })

  it.each(['.html.gz', '.html'])('reads an archived %s poster', async suffix => {
    const name = `${prefix}123/456${suffix}`
    objects.set(name, true)
    expect((await poster_file(id)).name).toBe(name)
  })

  it('prefers the active legacy writer when both names exist', async () => {
    objects.set(`${prefix}456.html`, true)
    objects.set(`${prefix}456.html.gz`, true)
    expect((await poster_file(id)).name).toBe(`${prefix}456.html.gz`)
  })

  it('does not mistake another poster for the requested one', async () => {
    objects.set(`${prefix}123/1456.html`, true)
    expect(await poster_file(id)).toBeNull()
  })
})
