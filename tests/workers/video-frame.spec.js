import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as video_frame from '@/workers/video-frame'
import { parseHTML } from 'linkedom'

vi.mock('linkedom', () => ({
  parseHTML: vi.fn()
}))

global.createImageBitmap = vi.fn()
global.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    this.width = width
    this.height = height
  }
  getContext() {
    return {
      drawImage: vi.fn()
    }
  }
}

describe('video-frame worker', () => {
  let console_warn_spy
  let postMessage_spy

  beforeEach(() => {
    vi.clearAllMocks()
    console_warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    postMessage_spy = vi.spyOn(global, 'postMessage').mockImplementation(() => {})

    const mock_image_bitmap = {
      close: vi.fn()
    }
    global.createImageBitmap.mockResolvedValue(mock_image_bitmap)
  })

  describe('prepare_and_render_frames', () => {
    it('parses SVG and renders frames', async () => {
      const mock_svg_string = '<svg><rect width="100" height="100"/></svg>'
      const mock_document = {
        documentElement: {
          outerHTML: mock_svg_string,
          querySelectorAll: vi.fn(() => [])
        }
      }

      parseHTML.mockReturnValue({ document: mock_document })

      const message = {
        data: {
          svg_string: mock_svg_string,
          canvas_width: 1920,
          canvas_height: 1080,
          fps: 30,
          start_frame: 0,
          end_frame: 1,
          duration: 1
        }
      }

      const result = await video_frame.prepare_and_render_frames(message)

      expect(parseHTML).toHaveBeenCalled()
      expect(result).toHaveProperty('frames')
      expect(result.frames).toHaveLength(1)
      expect(result.frames[0]).toHaveProperty('frame_index', 0)
      expect(result.frames[0]).toHaveProperty('image_bitmap')
    })

    it('handles animation elements', async () => {
      const mock_svg_string =
        '<svg><animate href="#rect" attributeName="x" values="0;100" dur="1s"/><rect id="rect"/></svg>'
      const mock_animate = {
        getAttribute: vi.fn(attr => {
          if (attr === 'dur') return '1s'
          if (attr === 'values') return '0;100'
          if (attr === 'attributeName') return 'x'
          if (attr === 'href') return '#rect'
          return null
        })
      }
      const mock_rect = {
        setAttribute: vi.fn()
      }
      const mock_document = {
        documentElement: {
          outerHTML: mock_svg_string,
          querySelectorAll: vi.fn(() => [mock_animate])
        },
        getElementById: vi.fn(() => mock_rect)
      }

      parseHTML
        .mockReturnValueOnce({ document: mock_document })
        .mockReturnValueOnce({ document: mock_document })

      const message = {
        data: {
          svg_string: mock_svg_string,
          canvas_width: 1920,
          canvas_height: 1080,
          fps: 30,
          start_frame: 0,
          end_frame: 1,
          duration: 1
        }
      }

      await video_frame.prepare_and_render_frames(message)

      expect(mock_rect.setAttribute).toHaveBeenCalled()
    })

    it('adds xmlns if missing', async () => {
      const mock_svg_string = '<svg><rect/></svg>'
      const mock_document = {
        documentElement: {
          outerHTML: mock_svg_string,
          querySelectorAll: vi.fn(() => [])
        }
      }

      parseHTML.mockReturnValue({ document: mock_document })

      const message = {
        data: {
          svg_string: mock_svg_string,
          canvas_width: 1920,
          canvas_height: 1080,
          fps: 30,
          start_frame: 0,
          end_frame: 1,
          duration: 1
        }
      }

      await video_frame.prepare_and_render_frames(message)

      expect(createImageBitmap).toHaveBeenCalled()
      const blob_call = createImageBitmap.mock.calls[0][0]
      expect(blob_call).toBeInstanceOf(Blob)
    })

    it('adds width/height if viewBox missing', async () => {
      const mock_svg_string = '<svg><rect/></svg>'
      const mock_document = {
        documentElement: {
          outerHTML: mock_svg_string,
          querySelectorAll: vi.fn(() => [])
        }
      }

      parseHTML.mockReturnValue({ document: mock_document })

      const message = {
        data: {
          svg_string: mock_svg_string,
          canvas_width: 1920,
          canvas_height: 1080,
          fps: 30,
          start_frame: 0,
          end_frame: 1,
          duration: 1
        }
      }

      await video_frame.prepare_and_render_frames(message)

      expect(createImageBitmap).toHaveBeenCalled()
    })

    it('handles createImageBitmap with resize', async () => {
      const mock_svg_string = '<svg><rect/></svg>'
      const mock_document = {
        documentElement: {
          outerHTML: mock_svg_string,
          querySelectorAll: vi.fn(() => [])
        }
      }

      parseHTML.mockReturnValue({ document: mock_document })
      global.createImageBitmap.mockResolvedValue({ close: vi.fn() })

      const message = {
        data: {
          svg_string: mock_svg_string,
          canvas_width: 1920,
          canvas_height: 1080,
          fps: 30,
          start_frame: 0,
          end_frame: 1,
          duration: 1
        }
      }

      await video_frame.prepare_and_render_frames(message)

      expect(createImageBitmap).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.objectContaining({
          resizeWidth: 1920,
          resizeHeight: 1080,
          resizeQuality: 'high'
        })
      )
    })

    it('falls back to canvas when resize fails', async () => {
      const mock_svg_string = '<svg><rect/></svg>'
      const mock_document = {
        documentElement: {
          outerHTML: mock_svg_string,
          querySelectorAll: vi.fn(() => [])
        }
      }

      parseHTML.mockReturnValue({ document: mock_document })
      global.createImageBitmap
        .mockRejectedValueOnce(new Error('Resize not supported'))
        .mockResolvedValueOnce({ close: vi.fn() })
        .mockResolvedValueOnce({ close: vi.fn() })

      const message = {
        data: {
          svg_string: mock_svg_string,
          canvas_width: 1920,
          canvas_height: 1080,
          fps: 30,
          start_frame: 0,
          end_frame: 1,
          duration: 1
        }
      }

      await video_frame.prepare_and_render_frames(message)

      expect(createImageBitmap).toHaveBeenCalledTimes(3)
    })

    it('renders multiple frames', async () => {
      const mock_svg_string = '<svg><rect/></svg>'
      const mock_document = {
        documentElement: {
          outerHTML: mock_svg_string,
          querySelectorAll: vi.fn(() => [])
        }
      }

      parseHTML.mockReturnValue({ document: mock_document })

      const message = {
        data: {
          svg_string: mock_svg_string,
          canvas_width: 1920,
          canvas_height: 1080,
          fps: 30,
          start_frame: 0,
          end_frame: 3,
          duration: 1
        }
      }

      const result = await video_frame.prepare_and_render_frames(message)

      expect(result.frames).toHaveLength(3)
      expect(result.frames[0].frame_index).toBe(0)
      expect(result.frames[1].frame_index).toBe(1)
      expect(result.frames[2].frame_index).toBe(2)
    })
  })

  describe('route_message', () => {
    it('routes prepare_and_render:frames message', async () => {
      const mock_svg_string = '<svg><rect/></svg>'
      const mock_document = {
        documentElement: {
          outerHTML: mock_svg_string,
          querySelectorAll: vi.fn(() => [])
        }
      }

      parseHTML.mockReturnValue({ document: mock_document })

      const message = {
        data: {
          route: 'prepare_and_render:frames',
          svg_string: mock_svg_string,
          canvas_width: 1920,
          canvas_height: 1080,
          fps: 30,
          start_frame: 0,
          end_frame: 1,
          duration: 1
        }
      }

      const result = await video_frame.route_message(message)

      expect(result).toHaveProperty('frames')
    })

    it('handles unknown route', async () => {
      const message = { data: { route: 'unknown:route' } }
      const result = await video_frame.route_message(message)

      expect(console_warn_spy).toHaveBeenCalledWith('unknown route', 'unknown:route')
      expect(result).toEqual({})
    })
  })
})

