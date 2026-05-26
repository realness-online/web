<script setup>
  /** @typedef {import('@/types').Id} Id */
  /** @typedef {import('@/3d/engine/types.js').PosterSceneController} PosterSceneController */
  import {
    ref,
    onMounted as mounted,
    onBeforeUnmount as before_unmount
  } from 'vue'
  import { as_query_id } from '@/utils/itemid'
  import { prepare_poster_svg_for_3d } from '@/utils/export-poster'
  import { use_poster_scene_preferences } from '@/use/poster-scene-preferences'
  import { register_viewer } from '@/3d/engine/shared-renderer.js'
  import { create_poster_scene } from '@/3d/scenes/create-poster-scene.js'
  import { register_live_poster_scene } from '@/3d/scenes/live-poster-scene.js'

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
  /** @type {(() => void) | null} */
  let unregister_live_scene = null
  let mount_active = false

  use_poster_scene_preferences(scene_ref)

  mounted(async () => {
    mount_active = true
    const svg_el = document.getElementById(
      as_query_id(/** @type {Id} */ (props.itemid))
    )
    if (!svg_el || !(svg_el instanceof SVGSVGElement)) return

    const svg_string = await prepare_poster_svg_for_3d(
      svg_el,
      /** @type {Id} */ (props.itemid)
    )
    if (!mount_active) return

    const scene_controller = create_poster_scene(svg_string)
    await scene_controller.wait_for_textures()
    if (!mount_active) return

    viewer = register_viewer(canvas_ref.value, scene_controller)
    viewer.start_enter(props.on_svg_zoom)
    scene_ref.value = scene_controller
    unregister_live_scene = register_live_poster_scene(
      /** @type {Id} */ (props.itemid),
      scene_controller
    )
  })

  before_unmount(() => {
    mount_active = false
    unregister_live_scene?.()
    unregister_live_scene = null
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
  <canvas
    ref="canvas_ref"
    class="viewer_3d"
    @contextmenu.prevent
    @selectstart.prevent />
</template>

<style lang="stylus">
  canvas.viewer_3d {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-user-drag: none;
  }
</style>
