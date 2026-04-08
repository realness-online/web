import { ref } from 'vue'

/** Blocks live poster SMIL while video export runs (as-animation respects this). */
const poster_video_export_count = ref(0)

export const poster_video_export_active = poster_video_export_count

/**
 * Call when starting render_svg_to_video_blob; pair with end_poster_video_export in finally.
 */
export const begin_poster_video_export = () => {
  poster_video_export_count.value++
}

export const end_poster_video_export = () => {
  poster_video_export_count.value = Math.max(0, poster_video_export_count.value - 1)
}
