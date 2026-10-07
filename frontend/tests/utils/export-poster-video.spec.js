import { vi, describe, it, expect, beforeEach, afterEach } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  render_svg_to_video_blob: vi.fn(async () => new Blob(['video'])),
  download_video: vi.fn(),
  level51_video_size: vi.fn(() => ({ width: 3840, height: 2160 })),
  get_filename_for_poster: vi.fn(async () => 'poster.mov')
}))

vi.mock('@/utils/svg-to-video', () => ({
  level51_video_size: mocks.level51_video_size,
  render_svg_to_video_blob: mocks.render_svg_to_video_blob,
  download_video: mocks.download_video
}))

vi.mock('@/utils/export-poster', () => ({
  get_filename_for_poster: mocks.get_filename_for_poster
}))

import { export_poster_to_video_with_audio } from '@/utils/export-poster-video'

const make_svg = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  Object.defineProperty(svg, 'viewBox', {
    value: { baseVal: { width: 1600, height: 900 } }
  })
  return svg
}

describe('export_poster_to_video_with_audio', () => {
  let get_by_id
  let svg

  beforeEach(() => {
    vi.clearAllMocks()
    svg = make_svg()
    get_by_id = vi.spyOn(document, 'getElementById').mockReturnValue(svg)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the poster video and downloads it', async () => {
    await export_poster_to_video_with_audio('/owner/posters/1')
    expect(get_by_id).toHaveBeenCalled()
    expect(mocks.render_svg_to_video_blob).toHaveBeenCalledWith(
      svg,
      expect.objectContaining({
        width: 3840,
        height: 2160,
        suggested_filename: 'poster.mov'
      })
    )
    expect(mocks.download_video).toHaveBeenCalledWith(
      expect.any(Blob),
      'poster.mov'
    )
  })

  it('passes audio buffers for the soundtrack, looping to their length', async () => {
    const buffers = [{ duration: 2, sampleRate: 48000, numberOfChannels: 2 }]
    await export_poster_to_video_with_audio('/owner/posters/1', {
      audio_buffers: buffers
    })
    expect(mocks.render_svg_to_video_blob).toHaveBeenCalledWith(
      svg,
      expect.objectContaining({ audio_buffers: buffers })
    )
  })

  it('ignores a non-vector id without rendering', async () => {
    await export_poster_to_video_with_audio('not-a-vector-id')
    expect(mocks.render_svg_to_video_blob).not.toHaveBeenCalled()
  })
})
