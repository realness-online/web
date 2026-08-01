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

describe('@/utils/svg-to-video', () => {
  beforeEach(() => {
    add_calls.length = 0
    audio_calls.length = 0
    audio_config = null
    vi.clearAllMocks()

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

  it('holds each rendered frame across multiple 24fps ticks instead of encoding one-per-tick', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.pauseAnimations = vi.fn()
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 100, height: 100 } }
    })

    const blob = await render_svg_to_video_blob(svg, {
      max_duration: 1, // small on purpose: keeps the frame count fast to test
      width: 100,
      height: 100
    })

    // FRAMES_PER_SECOND=3, duration=1s → total_frames = floor(1*3)+1 = 4
    // FRAME_HOLD=4 → 16 encoded frames, each pair 4 apart sharing a rendered pose
    expect(add_calls.length).toBe(16)

    // Every 4 consecutive calls hold the same duration and are spaced 1/24s apart.
    for (let i = 0; i < add_calls.length; i++) {
      expect(add_calls[i].duration).toBeCloseTo(1 / 24, 5)
      expect(add_calls[i].timestamp).toBeCloseTo(i / 24, 5)
    }

    expect(blob).toBeInstanceOf(Blob)
  })

  it('cross-fades between rasterized frames without rasterizing more of them', async () => {
    let image_count = 0
    global.Image = class {
      constructor() {
        image_count++
      }
      set src(_value) {
        this.onload?.()
      }
    }

    const seen_images = new Set()
    const alphas_seen = []
    const mock_ctx = {
      clearRect: vi.fn(),
      globalAlpha: 1,
      drawImage: vi.fn(image => {
        seen_images.add(image)
        alphas_seen.push(mock_ctx.globalAlpha)
      })
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mock_ctx
    )

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.pauseAnimations = vi.fn()
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 100, height: 100 } }
    })

    await render_svg_to_video_blob(svg, {
      max_duration: 1,
      width: 100,
      height: 100
    })

    // total_frames = 4 for max_duration=1 — same rasterization count as
    // before blending was added, regardless of FRAME_HOLD.
    expect(image_count).toBe(4)

    // More than one distinct rasterized image was drawn (the blend actually
    // reaches toward the next sample, not just redrawing one pose forever).
    expect(seen_images.size).toBeGreaterThan(1)

    // Some draw used a partial alpha (a real cross-fade), not just 0 or 1.
    expect(alphas_seen.some(alpha => alpha > 0 && alpha < 1)).toBe(true)
  })

  it('muxes audio as a soundtrack and loops the animation to the audio length', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.pauseAnimations = vi.fn()
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 100, height: 100 } }
    })

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

    // AAC encoding is requested; rate/channels come from the buffer itself,
    // so the config carries only the codec and target bitrate.
    expect(audio_config).toEqual({
      codec: 'aac',
      bitrate: 192000
    })

    // The video duration equals the total audio length (0.5s), not the
    // default cycle length, so the animation loops to fit the track.
    // FRAMES_PER_SECOND=3, at 0.5s -> floor(0.5*3)+1 = 2 sample moments,
    // each held FRAME_HOLD=4 ticks -> 8 encoded frames.
    expect(add_calls.length).toBe(8)
  })

  it('continues animating past one cycle for audio longer than the cycle', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.pauseAnimations = vi.fn()
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 100, height: 100 } }
    })

    // default export speed is 'crawl' -> cycle = BASE_DURATION(180) * 2 = 360s
    // Render 367s: beyond one cycle, the sampled animation time wraps back to
    // the start of the cycle so the animation repeats instead of stopping.
    await render_svg_to_video_blob(svg, {
      width: 100,
      height: 100,
      max_duration: 367
    })

    // floor(367*3)+1 = 1102 sample moments, each held FRAME_HOLD=4 -> 4408.
    // Rendering the full requested length (not truncated at one 360s cycle)
    // proves the loop continuation path emits frames past the boundary.
    expect(add_calls.length).toBe(4408)
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
