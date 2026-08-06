import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { clear_raster_frames } from '../../scripts/lib/raster-frames.js'

let poster_dir

const write = (name, contents) =>
  fs.writeFileSync(path.join(poster_dir, name), contents)

const names = () => fs.readdirSync(poster_dir).sort()

beforeEach(() => {
  poster_dir = fs.mkdtempSync(path.join(tmpdir(), 'raster-frames-'))
})

afterEach(() => {
  fs.rmSync(poster_dir, { recursive: true, force: true })
})

describe('scripts/lib/raster-frames', () => {
  it('clears the pngs and keeps the traced svgs', () => {
    write('poster-00001.png', 'aaaa')
    write('poster-00001.svg', '<svg />')
    write('poster-00002.png', 'bb')
    write('poster-00002.svg', '<svg />')

    expect(clear_raster_frames(poster_dir)).toEqual({ count: 2, bytes: 6 })
    expect(names()).toEqual(['poster-00001.svg', 'poster-00002.svg'])
  })

  it('leaves anything that is not a png alone', () => {
    write('notes.md', 'keep me')
    write('poster-00001.jpg', 'keep me too')
    write('poster-00001.png', 'go')

    expect(clear_raster_frames(poster_dir).count).toBe(1)
    expect(names()).toEqual(['notes.md', 'poster-00001.jpg'])
  })

  it('reports nothing freed for a directory with no pngs', () => {
    write('poster-00001.svg', '<svg />')

    expect(clear_raster_frames(poster_dir)).toEqual({ count: 0, bytes: 0 })
    expect(names()).toEqual(['poster-00001.svg'])
  })
})
