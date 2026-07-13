import { vi } from 'vite-plus/test'
import { render_svg_to_video_blob } from '@/utils/svg-to-video'

const add_calls = []
const mock_canvas_source = {
  add: vi.fn(async (timestamp, duration) => {
    add_calls.push({ timestamp, duration })
  }),
  close: vi.fn()
}

class MockBufferTarget {
  buffer = new Uint8Array([1, 2, 3])
}

const mock_output = {
  target: null,
  start: vi.fn(async () => {}),
  addVideoTrack: vi.fn(),
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
  })
}))

describe('@/utils/svg-to-video', () => {
  beforeEach(() => {
    add_calls.length = 0
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
})
