import { vi } from 'vite-plus/test'
import {
  render_svg_to_video_blob,
  level51_video_size
} from '@/utils/svg-to-video'

const add_calls = []
const mock_canvas_source = {
  add: vi.fn(async (timestamp, duration) => {
    add_calls.push({ timestamp, duration })
  }),
  close: vi.fn()
}

const audio_calls = []
const mock_audio_source = {
  add: vi.fn(async buffer => {
    audio_calls.push(buffer)
  }),
  close: vi.fn()
}
let audio_config = null

class MockBufferTarget {
  buffer = new Uint8Array([1, 2, 3])
}

const mock_output = {
  target: null,
  start: vi.fn(async () => {}),
  addVideoTrack: vi.fn(),
  addAudioTrack: vi.fn(),
  finalize: vi.fn(async () => {})
}

vi.mock('mediabunny', () => ({
  Output: vi.fn(function (options) {
    mock_output.target = options.target
    return mock_output
  }),
  MovOutputFormat: vi.fn(),
  BufferTarget: vi.fn(function () {
    return new MockBufferTarget()
  }),
  StreamTarget: vi.fn(function () {
    return {}
  }),
  CanvasSource: vi.fn(function () {
    return mock_canvas_source
  }),
  AudioBufferSource: vi.fn(function (config) {
    audio_config = config
    return mock_audio_source
  })
}))

/**
 * Builds a minimal poster-like SVG: a target element with a SMIL animate
 * whose href resolves to it (mirroring how as-animation emits animates that
 * target the poster's shadow fragments).
 */
const make_svg = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.pauseAnimations = vi.fn()
  svg.setCurrentTime = vi.fn()
  Object.defineProperty(svg, 'viewBox', {
    value: { baseVal: { width: 100, height: 100 } }
  })
  const target = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  target.id = 'as-fragment-poster-light'
  target.setAttribute('itemprop', 'light')
  target.setAttribute('fill-opacity', '0.9')
  target.setAttribute('stroke-width', '0.33')
  svg.appendChild(target)

  const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate')
  anim.setAttribute('href', '#as-fragment-poster-light')
  anim.setAttribute('attributeName', 'stroke-width')
  anim.setAttribute('dur', '18s')
  svg.appendChild(anim)

  const anim_geometry = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'animate'
  )
  anim_geometry.setAttribute('href', '#as-fragment-poster-light')
  anim_geometry.setAttribute('attributeName', 'x')
  anim_geometry.setAttribute('dur', '18s')
  svg.appendChild(anim_geometry)

  const defs_svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  defs_svg.setAttribute('data-poster-symbol-defs', '')
  defs_svg.setAttribute('aria-hidden', 'true')
  const symbol = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'symbol'
  )
  symbol.id = 'as-fragment-poster-shadows-light'
  defs_svg.appendChild(symbol)
  document.body.appendChild(defs_svg)

  document.body.appendChild(svg)

  return svg
}

describe('@/utils/svg-to-video', () => {
  let svg

  beforeEach(() => {
    add_calls.length = 0
    audio_calls.length = 0
    audio_config = null
    vi.clearAllMocks()
    svg = make_svg()

    const live_target = document.getElementById('as-fragment-poster-light')
    Object.defineProperty(live_target, 'x', {
      value: {
        animVal: { valueAsString: '42' }
      },
      configurable: true
    })

    vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
      getPropertyValue: vi.fn(property => {
        const values = {
          'fill-opacity': '0.833333',
          'stroke-opacity': '0.42',
          'stroke-width': '0.162458px',
          'stroke-dashoffset': '-24px'
        }
        return values[property] || ''
      })
    })

    global.Image = class {
      set src(_value) {
        this.onload?.()
      }
    }

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn()
    })
  })

  it('encodes one frame per seek at the output frame rate, no holds', async () => {
    const blob = await render_svg_to_video_blob(svg, {
      max_duration: 1,
      width: 100,
      height: 100
    })

    expect(add_calls.length).toBe(25)

    for (let i = 0; i < add_calls.length; i++) {
      expect(add_calls[i].duration).toBeCloseTo(1 / 24, 5)
      expect(add_calls[i].timestamp).toBeCloseTo(i / 24, 5)
    }

    expect(blob).toBeInstanceOf(Blob)
  })

  it('drives the native SMIL timeline and rasterizes a baked frame per tick', async () => {
    const mock_ctx = {
      clearRect: vi.fn(),
      drawImage: vi.fn()
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mock_ctx
    )

    await render_svg_to_video_blob(svg, {
      max_duration: 1,
      width: 100,
      height: 100
    })

    expect(svg.pauseAnimations).toHaveBeenCalled()
    expect(svg.setCurrentTime).toHaveBeenCalledTimes(25)
    expect(svg.setCurrentTime).toHaveBeenNthCalledWith(1, 0)
    expect(svg.setCurrentTime).toHaveBeenLastCalledWith(1)

    expect(svg.querySelectorAll('animate').length).toBe(2)

    expect(mock_ctx.drawImage).toHaveBeenCalledTimes(25)
    const drawn = mock_ctx.drawImage.mock.calls[0][0]
    expect(drawn).toBeInstanceOf(global.Image)

    expect(getComputedStyle).toHaveBeenCalled()
  })

  it('bakes the seeked SMIL state into the serialized frame', async () => {
    const serializer_spy = vi.spyOn(
      XMLSerializer.prototype,
      'serializeToString'
    )

    await render_svg_to_video_blob(svg, {
      max_duration: 1,
      width: 100,
      height: 100
    })

    const serialized = serializer_spy.mock.results[0].value
    expect(serialized).toContain('stroke-width="0.162458px"')
    expect(serialized).toContain('x="42"')
    expect(serialized).not.toContain('<animate')
  })

  it('muxes audio as a soundtrack and runs for exactly the audio length', async () => {
    const buffers = [
      { duration: 0.25, sampleRate: 48000, numberOfChannels: 2 },
      { duration: 0.25, sampleRate: 48000, numberOfChannels: 2 }
    ]

    await render_svg_to_video_blob(svg, {
      width: 100,
      height: 100,
      audio_buffers: buffers
    })

    expect(audio_calls).toEqual(buffers)

    expect(mock_output.addAudioTrack).toHaveBeenCalledWith(mock_audio_source)

    expect(audio_config).toEqual({
      codec: 'pcm-f32'
    })

    expect(add_calls.length).toBe(13)
  })

  it('keeps seeking past one cycle, letting SMIL repeat natively', async () => {
    await render_svg_to_video_blob(svg, {
      width: 100,
      height: 100,
      max_duration: 367
    })

    expect(add_calls.length).toBe(8809)
    expect(svg.setCurrentTime).toHaveBeenLastCalledWith(367)
  })
})

describe('level51_video_size', () => {
  const macroblocks = ({ width, height }) =>
    Math.ceil(width / 16) * Math.ceil(height / 16)
  const LEVEL51 = 36864

  it('renders 16:9 posters at true 4K (3840x2160)', () => {
    const size = level51_video_size({ width: 1600, height: 900 })
    expect(size).toEqual({ width: 3840, height: 2160 })
  })

  it('scales square posters inside Level 5.1 without cropping', () => {
    const size = level51_video_size({ width: 1600, height: 1600 })
    expect(macroblocks(size)).toBeLessThanOrEqual(LEVEL51)
    expect(size.width).toBe(size.height)
  })

  it('scales tall posters inside Level 5.1 without cropping', () => {
    const size = level51_video_size({ width: 800, height: 1600 })
    expect(macroblocks(size)).toBeLessThanOrEqual(LEVEL51)
    expect(size.width / size.height).toBeCloseTo(0.5, 2)
  })

  it('keeps every aspect ratio within the Level-5.1 ceiling', () => {
    const aspects = [
      { width: 100, height: 100 },
      { width: 50, height: 300 },
      { width: 300, height: 50 },
      { width: 64, height: 27 },
      { width: 1, height: 10 }
    ]
    for (const viewbox of aspects) {
      const size = level51_video_size(viewbox)
      expect(macroblocks(size)).toBeLessThanOrEqual(LEVEL51)
      expect(size.width % 2).toBe(0)
      expect(size.height % 2).toBe(0)
    }
  })
})
