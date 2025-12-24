<script setup>
  import { as_day_and_time } from '@/utils/date'
  import { load, as_query_id } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  import icon from '@/components/icon'
  import { ref, computed, onMounted } from 'vue'
  import {
    render_svg_to_video_blob,
    download_video
  } from '@/utils/svg-to-video'
  import { animation_speed } from '@/utils/preference'
  import { to_hsla } from '@/utils/colors'
  import css_var from '@/utils/css-var'

  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    }
  })

  defineOptions({
    name: 'DownloadVideo'
  })

  const file_name = ref(null)
  const working = ref(false)
  const progress = ref(0)
  const total_frames = ref(0)
  const state = ref('idle')

  const computed_progress = computed(() => {
    if (total_frames.value === 0) return 0
    return Math.round((progress.value / total_frames.value) * 100)
  })

  const state_message = computed(() => {
    if (!working.value) return 'Download video'
    if (state.value === 'rendering') return 'Rendering video...'
    if (state.value === 'encoding') return 'Encoding video...'
    if (state.value === 'downloading') return 'Downloading...'
    return 'Preparing...'
  })

  const icon_rotation = computed(() => {
    if (!working.value || total_frames.value === 0) return 0
    return (computed_progress.value / 100) * 360
  })

  const icon_color = computed(() => {
    if (!working.value || total_frames.value === 0) return 'inherit'

    // Get current color from CSS variable or computed style
    const current_color = css_var('--green') || 'hsla(136, 47%, 57%, 0.75)'
    const hsl = to_hsla(current_color)

    // Interpolate hue through color wheel (0-360 degrees)
    // Start at current hue, travel through the wheel based on progress
    const start_hue = hsl.h
    const progress_ratio = computed_progress.value / 100
    const hue_shift = progress_ratio * 360
    const new_hue = (start_hue + hue_shift) % 360

    // Keep saturation and lightness constant, maintain alpha
    return `hsla(${Math.round(new_hue)}, ${hsl.s}%, ${hsl.l}%, ${hsl.a})`
  })

  const download = async () => {
    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg || !(svg instanceof SVGSVGElement)) return

    // Find the figure element containing the SVG
    const figure = svg.closest('figure.poster')
    if (!figure) return

    // Get rendered dimensions from figure to calculate aspect ratio
    const rect = figure.getBoundingClientRect()
    const aspect_ratio = rect.width / rect.height

    // Set smallest side to 1080px, scale other side proportionally
    const target_smallest_side = 1080
    const video_width =
      aspect_ratio >= 1
        ? Math.round(target_smallest_side * aspect_ratio)
        : target_smallest_side
    const video_height =
      aspect_ratio >= 1
        ? target_smallest_side
        : Math.round(target_smallest_side / aspect_ratio)

    working.value = true
    progress.value = 0
    state.value = 'rendering'

    try {
      // Ensure animations are enabled for video
      svg.unpauseAnimations()

      const blob = await render_svg_to_video_blob(svg, {
        fps: 24,
        animation_speed: animation_speed.value,
        width: video_width,
        height: video_height,
        suggested_filename: file_name.value,
        on_progress: (frame, total) => {
          progress.value = frame
          total_frames.value = total
        }
      })

      state.value = 'encoding'
      await new Promise(resolve => setTimeout(resolve, 100))

      state.value = 'downloading'
      download_video(blob, file_name.value)

      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      console.error('Failed to render video:', error)
      state.value = 'error'
    } finally {
      working.value = false
      progress.value = 0
      total_frames.value = 0
      state.value = 'idle'
    }
  }

  const get_video_name = async () => {
    const info = props.itemid.split('/')
    const author_id = `/${info[1]}`
    const time = as_day_and_time(Number(info[3]))
    const creator = await load(author_id)
    const facts = `${time}.mov`
    if (creator?.name) {
      const safe_name = creator.name.replace(/\s+/g, '_')
      return `${safe_name}_${facts}`
    }
    return facts
  }

  onMounted(async () => {
    file_name.value = await get_video_name()
  })
</script>

<template>
  <button
    @click="download"
    :disabled="working"
    :aria-label="state_message"
    :data-state="state">
    <icon
      name="download"
      :style="{
        transform: `rotate(${icon_rotation}deg)`,
        color: icon_color
      }" />
  </button>
</template>

<style lang="stylus">
  button[data-state] {
    background: none
    border: none
    padding: 0
    cursor: pointer
    color: inherit
    display: inline-flex
    align-items: center
    gap: calc(var(--base-line) * 0.25)

    &:disabled {
      opacity: 0.5
      cursor: not-allowed
    }

    &[data-state="rendering"],
    &[data-state="encoding"],
    &[data-state="downloading"] {
      animation-name: working
    }

    &[data-state="error"] {
      color: red
    }

    icon {
      transition: transform 0.1s linear
    }
  }
</style>
