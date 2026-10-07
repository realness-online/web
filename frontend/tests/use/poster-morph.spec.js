import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { get, set } from 'idb-keyval'
import { load_shadow_into_vector } from '@/utils/poster-layers'
import {
  as_layer_paths,
  as_path_data,
  morph_paths,
  release_morph_worker,
  shadow_layers
} from '@/use/poster-morph'

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined)
}))

// The real one reaches for storage and the network
vi.mock('@/utils/poster-layers', () => ({
  load_shadow_into_vector: vi.fn(async vector => vector)
}))

const poster_id = '/+16282281824/posters/1730000000000'

/** Stands in for the built worker, which tests never load */
class Fake_Worker {
  static instances = []
  static reply = { paths: ['a', 'b', 'c', 'd'] }
  /** @type {((message: object) => object) | null} Per-message reply builder */
  static reply_for = null

  constructor() {
    this.posted = []
    this.listeners = {}
    this.terminated = false
    Fake_Worker.instances.push(this)
  }

  addEventListener(name, handler) {
    this.listeners[name] = [...(this.listeners[name] || []), handler]
  }

  removeEventListener(name, handler) {
    this.listeners[name] = (this.listeners[name] || []).filter(
      listener => listener !== handler
    )
  }

  postMessage(message) {
    this.posted.push(message)
    queueMicrotask(() => {
      // Like the real worker: the id is echoed and every listener hears it
      const reply = Fake_Worker.reply_for
        ? Fake_Worker.reply_for(message)
        : Fake_Worker.reply
      const data = { id: message.id, ...reply }
      for (const handler of [...(this.listeners.message || [])])
        handler({ data })
    })
  }

  terminate() {
    this.terminated = true
  }
}

describe('poster-morph', () => {
  beforeEach(() => {
    Fake_Worker.instances = []
    Fake_Worker.reply = { paths: ['a', 'b', 'c', 'd'] }
    Fake_Worker.reply_for = null
    vi.stubGlobal('Worker', Fake_Worker)
    vi.mocked(get).mockResolvedValue(null)
    vi.mocked(set).mockClear()
    vi.mocked(load_shadow_into_vector).mockImplementation(
      async vector => vector
    )
  })

  afterEach(() => {
    release_morph_worker()
    vi.unstubAllGlobals()
  })

  const vector = () => {
    const made = { id: poster_id, type: 'posters' }
    for (const [index, layer] of shadow_layers.entries()) {
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      path.setAttribute('d', `M${index} ${index}`)
      made[layer] = path
    }
    return made
  }

  describe('as_path_data', () => {
    it('reads d off a hydrated path element', () => {
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      path.setAttribute('d', 'M0 0')
      expect(as_path_data(path)).toBe('M0 0')
    })

    it('passes a plain string through', () => {
      expect(as_path_data('M1 1')).toBe('M1 1')
    })

    it('treats the directory placeholder as nothing to draw', () => {
      expect(as_path_data('')).toBe('')
      expect(as_path_data(undefined)).toBe('')
    })
  })

  describe('as_layer_paths', () => {
    it('returns the four densities in order', () => {
      expect(as_layer_paths(vector())).toEqual(['M0 0', 'M1 1', 'M2 2', 'M3 3'])
    })
  })

  describe('morph_paths', () => {
    it('normalizes in the worker and caches the result', async () => {
      const result = await morph_paths(poster_id, vector())
      expect(result).toEqual(['a', 'b', 'c', 'd'])
      expect(Fake_Worker.instances).toHaveLength(1)
      expect(Fake_Worker.instances[0].posted[0].route).toBe('normalize:morph')
      expect(vi.mocked(set)).toHaveBeenCalledOnce()
    })

    it('serves a cached poster without touching the worker', async () => {
      vi.mocked(get).mockResolvedValue(['cached', 'cached', 'cached', 'cached'])
      const result = await morph_paths(poster_id, vector())
      expect(result[0]).toBe('cached')
      expect(Fake_Worker.instances).toHaveLength(0)
    })

    it('shares one run when the same poster is asked for twice', async () => {
      const [first, second] = await Promise.all([
        morph_paths(poster_id, vector()),
        morph_paths(poster_id, vector())
      ])
      expect(first).toEqual(second)
      expect(Fake_Worker.instances[0].posted).toHaveLength(1)
    })

    it('keeps concurrent posters out of each other’s replies', async () => {
      // Five posters on a page all normalize on the shared worker at once.
      // Before replies carried ids, the first answer back resolved every
      // pending request - and got cached under the other posters' keys.
      Fake_Worker.reply_for = message => ({
        paths: message.paths.map(path => `normalized ${path}`)
      })
      const other = vector()
      for (const layer of shadow_layers) other[layer].setAttribute('d', 'M9 9')

      const [first, second] = await Promise.all([
        morph_paths(poster_id, vector()),
        morph_paths('/+1/posters/2', other)
      ])
      expect(first).toEqual(
        ['M0 0', 'M1 1', 'M2 2', 'M3 3'].map(d => `normalized ${d}`)
      )
      expect(second).toEqual(shadow_layers.map(() => 'normalized M9 9'))
    })

    it('keeps one worker across posters', async () => {
      await morph_paths(poster_id, vector())
      await morph_paths('/+1/posters/2', vector())
      expect(Fake_Worker.instances).toHaveLength(1)
    })

    it('fetches the shadows file for a split poster', async () => {
      // A split poster's record carries no densities of its own - they live in
      // a sibling shadows file, which is the shape most of the archive is in.
      const split = { id: poster_id, type: 'posters' }
      vi.mocked(load_shadow_into_vector).mockResolvedValue(vector())

      const result = await morph_paths(poster_id, split)
      expect(result).toEqual(['a', 'b', 'c', 'd'])
      expect(vi.mocked(load_shadow_into_vector)).toHaveBeenCalledWith(
        expect.objectContaining({ id: poster_id }),
        poster_id
      )
    })

    it('leaves the caller’s vector alone', async () => {
      const original = { id: poster_id, type: 'posters' }
      vi.mocked(load_shadow_into_vector).mockImplementation(async copy => {
        copy.light = 'M0 0'
        return copy
      })
      await morph_paths(poster_id, original)
      expect(original.light).toBeUndefined()
    })

    it('returns null when the poster has no geometry yet', async () => {
      const empty = {
        id: poster_id,
        light: '',
        regular: '',
        medium: '',
        bold: ''
      }
      expect(await morph_paths(poster_id, empty)).toBe(null)
      expect(Fake_Worker.instances).toHaveLength(0)
    })

    it('returns null rather than throwing when the worker fails', async () => {
      Fake_Worker.reply = { error: 'no' }
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(await morph_paths(poster_id, vector())).toBe(null)
      expect(vi.mocked(set)).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('lets a failed poster be retried', async () => {
      Fake_Worker.reply = { error: 'no' }
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await morph_paths(poster_id, vector())
      Fake_Worker.reply = { paths: ['a', 'b', 'c', 'd'] }
      expect(await morph_paths(poster_id, vector())).toEqual([
        'a',
        'b',
        'c',
        'd'
      ])
      warn.mockRestore()
    })
  })
})
