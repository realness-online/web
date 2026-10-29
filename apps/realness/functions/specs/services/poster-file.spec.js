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
  bucket.getFiles.mockImplementation(async () => [
    [...objects.keys()].map(name => ({ name }))
  ])
})

describe('poster_file', () => {
  it('reads a live poster as sync stores it', async () => {
    const name = `${prefix}456.html.gz`
    objects.set(name, true)
    expect((await poster_file(id)).name).toBe(name)
    expect(bucket.getFiles).not.toHaveBeenCalled()
  })

  it('reads an archived poster as sync stores it', async () => {
    const name = `${prefix}123/456.html.gz`
    objects.set(name, true)
    expect((await poster_file(id)).name).toBe(name)
  })

  it('falls back to the plain copy until gz6 removes it', async () => {
    const name = `${prefix}456.html`
    objects.set(name, true)
    expect((await poster_file(id)).name).toBe(name)
    expect(bucket.getFiles).not.toHaveBeenCalled()
  })

  it('prefers the sync copy when both exist', async () => {
    objects.set(`${prefix}456.html`, true)
    objects.set(`${prefix}456.html.gz`, true)
    expect((await poster_file(id)).name).toBe(`${prefix}456.html.gz`)
  })

  it('does not mistake another poster for the requested one', async () => {
    objects.set(`${prefix}123/1456.html.gz`, true)
    expect(await poster_file(id)).toBeNull()
  })
})
