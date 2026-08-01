/** @fileoverview Shared poster->video export, usable from the download menu and the bare-poster audio drop. */

/** @typedef {import('@/types').Id} Id */
import { as_query_id } from '@/utils/itemid'
import { is_vector_id } from '@/use/poster'
import {
  level51_video_size,
  render_svg_to_video_blob,
  download_video
} from '@/utils/svg-to-video'
import { get_filename_for_poster } from '@/utils/export-poster'
import { VIDEO_EXPORT_ANIMATION_SPEED } from '@/utils/animation-config'
import {
  begin_poster_video_export,
  end_poster_video_export
} from '@/use/poster-video-export'

/**
 * Renders and downloads the poster as 4K H.264 MOV, optionally muxing one or
 * more decoded audio buffers as the soundtrack. When audio is provided the
 * video runs exactly as long as the audio, looping the animation cycle to
 * cover it. Shared by the download menu (no audio) and dropping an audio file
 * on a bare poster (with audio) so neither depends on the other's mounting.
 *
 * @param {Id} itemid - Poster id (locates its live SVG in the DOM)
 * @param {object} [options]
 * @param {AudioBuffer[]} [options.audio_buffers] - Decoded audio to embed
 * @param {(frame: number, total: number) => void} [options.on_progress]
 * @returns {Promise<void>}
 */
export const export_poster_to_video_with_audio = async (
  itemid,
  options = {}
) => {
  if (!is_vector_id(itemid)) return

  const svg = document.getElementById(as_query_id(itemid))
  if (!svg || !(svg instanceof SVGSVGElement)) return

  const viewbox = svg.viewBox.baseVal
  // Largest H.264 Level-5.1-safe exported dimensions that keep the poster's
  // own aspect ratio (uncropped): true 4K for 16:9, scaled within the level
  // ceiling for square and portrait.
  const { width: video_width, height: video_height } =
    level51_video_size(viewbox)

  begin_poster_video_export()

  try {
    const video_filename = await get_filename_for_poster(itemid, 'mov')
    const blob = await render_svg_to_video_blob(svg, {
      animation_speed: VIDEO_EXPORT_ANIMATION_SPEED,
      width: video_width,
      height: video_height,
      suggested_filename: video_filename,
      audio_buffers: options.audio_buffers,
      on_progress: options.on_progress
    })
    // Null when the file was already saved via the File System Access API.
    if (blob) download_video(blob, video_filename)
  } catch (error) {
    console.error('Failed to render video:', error)
  } finally {
    end_poster_video_export()
  }
}
