<script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue'
  import { as_query_id } from '@/utils/itemid'
  import { build_download_svg } from '@/utils/export-poster'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    }
  })

  const canvas_ref = ref(null)
  let app = null

  onMounted(async () => {
    const svg_el = document.getElementById(as_query_id(props.itemid))
    if (!svg_el) return
    const prepared = build_download_svg(/** @type {SVGSVGElement} */ (svg_el))
    const svg_string = new XMLSerializer().serializeToString(prepared)
    const [{ create_app }, { create_poster_scene }] = await Promise.all([
      import('@3d/engine/create-app.js'),
      import('@3d/scenes/create-poster-scene.js')
    ])
    app = create_app({ canvas: canvas_ref.value })
    const scene_controller = create_poster_scene(svg_string)
    app.mount_scene(scene_controller)
    app.start()
  })

  onBeforeUnmount(() => {
    if (!app) return
    app.stop()
    app.get_renderer().dispose()
    app = null
  })
</script>

<template>
  <div class="viewer-3d">
    <canvas ref="canvas_ref" />
  </div>
</template>

<style lang="stylus">
  .viewer-3d {
    width: 100%;
    height: 100%;

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  }
</style>
