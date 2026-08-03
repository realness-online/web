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

  // The hidden defs svg the poster's symbols live in, so <use>/href targets
  // resolve in the standalone serialized frame.
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

    // The live target exposes a geometry animVal like Chrome does.
    const live_target = document.getElementById('as-fragment-poster-light')
    Object.defineProperty(live_target, 'x', {
      value: {
        animVal: { valueAsString: '42' }
      },
      configurable: true
    })

    vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
      getPropertyValue: vi.fn(property => {
        // Paint props reflect the seeked SMIL state in computed style.
        const values = {
          'fill-opacity': '0.833333',
          'stroke-opacity': '0.42',
          'stroke-width': '0.162458px',
          'stroke-dashoffset': '-24px'
        }
        return values[property] || ''
      })
    })

    // The serialized frame loads as an image immediately in the test env.
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

    // fps=24, duration=1s → floor(1*24)+1 = 25 frames, one encode each.
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

    // The timeline was frozen, then seeked once per frame.
    expect(svg.pauseAnimations).toHaveBeenCalled()
    expect(svg.setCurrentTime).toHaveBeenCalledTimes(25)
    expect(svg.setCurrentTime).toHaveBeenNthCalledWith(1, 0)
    expect(svg.setCurrentTime).toHaveBeenLastCalledWith(1)

    // The live svg keeps its SMIL elements after the export — the render
    // bakes values onto the clone only, and later frames seek the same live
    // timeline. Removing them here would freeze the video after frame 1.
    expect(svg.querySelectorAll('animate').length).toBe(2)

    // Every frame was drawn from the rasterized image, not the live svg
    // (drawImage rejects SVGSVGElement, so the frame goes through the
    // serialize → image path instead).
    expect(mock_ctx.drawImage).toHaveBeenCalledTimes(25)
    const drawn = mock_ctx.drawImage.mock.calls[0][0]
    expect(drawn).toBeInstanceOf(global.Image)

    // The baked frame carried the browser-computed animated value: the live
    // target's geometry animVal was read and written onto the serialized
    // clone as an attribute.
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
    // The animated stroke-width (from computed style) replaced the base 0.33.
    expect(serialized).toContain('stroke-width="0.162458px"')
    // The geometry animVal (x → 42) was baked in.
    expect(serialized).toContain('x="42"')
    // SMIL elements are stripped from the serialized frame.
    expect(serialized).not.toContain('<animate')
  })

  it('muxes audio as a soundtrack and runs for exactly the audio length', async () => {
    // Two buffers totaling 0.5s of audio.
    const buffers = [
      { duration: 0.25, sampleRate: 48000, numberOfChannels: 2 },
      { duration: 0.25, sampleRate: 48000, numberOfChannels: 2 }
    ]

    await render_svg_to_video_blob(svg, {
      width: 100,
      height: 100,
      audio_buffers: buffers
    })

    // Both buffers were handed to the audio source for encoding.
    expect(audio_calls).toEqual(buffers)

    // The audio track was registered on the muxer.
    expect(mock_output.addAudioTrack).toHaveBeenCalledWith(mock_audio_source)

    // Lossless float32 PCM is requested (no re-encode); rate/channels come
    // from the buffer itself, so the config carries only the codec.
    expect(audio_config).toEqual({
      codec: 'pcm-f32'
    })

    // The video duration equals the total audio length (0.5s), not the
    // default cycle length, so the animation runs to fit the track.
    // fps=24, at 0.5s -> floor(0.5*24)+1 = 13 frames.
    expect(add_calls.length).toBe(13)
  })

  it('keeps seeking past one cycle, letting SMIL repeat natively', async () => {
    // default export speed is 'crawl' -> cycle = BASE_DURATION(180) * 2 = 360s
    // Render 367s: the timeline keeps advancing past the cycle instead of
    // being wrapped — the poster's repeatCount="indefinite" animations loop
    // on their own, which is what makes audio longer than the cycle work.
    await render_svg_to_video_blob(svg, {
      width: 100,
      height: 100,
      max_duration: 367
    })

    // floor(367*24)+1 = 8809 frames, none truncated at the 360s cycle.
    expect(add_calls.length).toBe(8809)
    expect(svg.setCurrentTime).toHaveBeenLastCalledWith(367)
  })
})

describe('level51_video_size', () => {
  // Anything up to (and including) Level 5.1's 36,864 macroblocks encodes on
  // every browser's H.264 encoder; at 16x16 blocks, macroblocks =
  // ceil(w/16)*ceil(h/16).
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
    expect(size.width).toBe(size.height) // aspect preserved
  })

  it('scales tall posters inside Level 5.1 without cropping', () => {
    const size = level51_video_size({ width: 800, height: 1600 })
    expect(macroblocks(size)).toBeLessThanOrEqual(LEVEL51)
    expect(size.width / size.height).toBeCloseTo(0.5, 2) // aspect preserved
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
      expect(size.width % 2).toBe(0) // even dims - H.264 requires them
      expect(size.height % 2).toBe(0)
    }
  })
})
