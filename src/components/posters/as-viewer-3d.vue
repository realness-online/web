<script setup>
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {import('@/3d/engine/types.js').PosterSceneController} PosterSceneController */
  import {
    ref,
    watchEffect as watch_effect,
    onMounted as mounted,
    onBeforeUnmount as before_unmount
  } from 'vue'
  import { as_query_id } from '@/utils/itemid'
  import { prepare_poster_svg_for_3d } from '@/utils/export-poster'
  import { register_viewer } from '@/3d/engine/shared-renderer.js'
  import { create_poster_scene } from '@/3d/scenes/create-poster-scene.js'
  import {
    animate,
    mosaic,
    shadow,
    bold,
    medium,
    regular,
    light,
    background,
    boulders,
    rocks,
    gravel,
    sand,
    sediment,
    mosaic_spread,
    mosaic_opacity,
    shadow_spread,
    shadow_opacity,
    group_gap,
    tilt_amount,
    gyro_amount,
    haze_enabled,
    haze_color,
    haze_density,
    drift_amount,
    drift_speed,
    breathing_amount,
    breathing_speed
  } from '@/utils/preference'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    },
    on_svg_zoom: {
      type: Function,
      default: null
    }
  })

  const canvas_ref = ref(null)
  /** @type {import('vue').Ref<PosterSceneController | null>} */
  const scene_ref = ref(null)
  let viewer = null

  watch_effect(() => {
    const scene = scene_ref.value
    if (!scene) return
    scene.set_mosaic_visible(mosaic.value)
    scene.set_shadow_visible(shadow.value)
    scene.set_mosaic_spread(mosaic_spread.value)
    scene.set_mosaic_opacity(mosaic_opacity.value)
    scene.set_shadow_spread(shadow_spread.value)
    scene.set_shadow_opacity(shadow_opacity.value)
    scene.set_group_gap(group_gap.value)
    scene.set_tilt_amount(tilt_amount.value)
    scene.set_gyro_amount(gyro_amount.value)
    scene.set_haze_enabled(haze_enabled.value)
    scene.set_haze_color(haze_color.value)
    scene.set_haze_density(haze_density.value)
    scene.set_mosaic_layer_visible('boulders', boulders.value)
    scene.set_mosaic_layer_visible('rocks', rocks.value)
    scene.set_mosaic_layer_visible('gravel', gravel.value)
    scene.set_mosaic_layer_visible('sand', sand.value)
    scene.set_mosaic_layer_visible('sediment', sediment.value)
    scene.set_shadow_layer_visible('bold', bold.value)
    scene.set_shadow_layer_visible('medium', medium.value)
    scene.set_shadow_layer_visible('regular', regular.value)
    scene.set_shadow_layer_visible('light', light.value)
    scene.set_shadow_layer_visible('background', background.value)
    scene.set_motion_enabled(animate.value)
    scene.set_drift_amount(drift_amount.value)
    scene.set_drift_speed(drift_speed.value)
    scene.set_breathing_amount(breathing_amount.value)
    scene.set_breathing_speed(breathing_speed.value)
  })

  mounted(async () => {
    const svg_el = document.getElementById(
      as_query_id(/** @type {Id} */ (props.itemid))
    )
    if (!svg_el || !(svg_el instanceof SVGSVGElement)) return

    const svg_string = await prepare_poster_svg_for_3d(
      svg_el,
      /** @type {Id} */ (props.itemid)
    )
    const scene_controller = create_poster_scene(svg_string)
    viewer = register_viewer(canvas_ref.value, scene_controller)
    viewer.start_enter(props.on_svg_zoom)
    scene_ref.value = scene_controller
  })

  before_unmount(() => {
    scene_ref.value = null
    viewer?.destroy()
    viewer = null
  })

  defineExpose({
    start_leave: (on_svg_zoom, on_done) =>
      viewer?.start_leave(on_svg_zoom, on_done)
  })
</script>

<template>
  <canvas ref="canvas_ref" class="viewer_3d" />
</template>

<style lang="stylus">
  canvas.viewer_3d {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
