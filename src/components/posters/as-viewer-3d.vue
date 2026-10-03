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
  import { use_poster_svg_activate_pointer } from '@/use/poster-svg-activate-pointer'
  import { register_viewer } from '@/3d/engine/shared-renderer.js'
  import { create_poster_scene } from '@/3d/scenes/create-poster-scene.js'
  import { register_live_poster_scene } from '@/3d/scenes/live-poster-scene.js'
  import { attach_live_poster_texture } from '@/3d/utils/live-shadow-texture.js'
  import { live_texture_3d } from '@/utils/preference'
  import { is_ios } from '@/utils/platform'

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
  // Reveal the poster menu with the same gesture as SVG mode: long-press on touch,
  // click on mouse. Movement cancels it — a drag stays reserved for orbiting here,
  // the way it's reserved for panning the poster left/right in 2D.
  const emit = defineEmits(['select'])

  const ORBIT_MOVE_CANCEL_PX = 8
  const was_orbit = ref(false)
  let orbit_down_x = 0
  let orbit_down_y = 0
  const {
    handle_pointerdown: on_pointerdown,
    handle_pointermove,
    handle_pointerup: on_pointerup,
    handle_pointerleave: on_pointerleave
  } = use_poster_svg_activate_pointer({
    on_activate: () => emit('select'),
    touch_uses_long_press: true,
    was_pan_gesture: was_orbit,
    on_non_touch_pointerdown: event => {
      orbit_down_x = event.clientX
      orbit_down_y = event.clientY
      was_orbit.value = false
    }
  })
  // A hand on the poster orbits the 3D layers; the SVG under them stays put, so
  // the two part company for as long as the gesture lasts. The figure fades the
  // 3D out while `moving` is set, then brings it back once the hand lets go.
  const MOVING_SETTLE_MS = 260
  const moving = ref(false)
  let pressed = false
  /** @type {ReturnType<typeof setTimeout> | null} */
  let settle_timer = null

  const mark_moving = () => {
    moving.value = true
    if (settle_timer !== null) clearTimeout(settle_timer)
    settle_timer = setTimeout(() => {
      settle_timer = null
      moving.value = false
    }, MOVING_SETTLE_MS)
  }

  // A tap or a hold stays still, so only an actual drag fades the 3D out.
  const on_pointer_down = event => {
    pressed = true
    on_pointerdown(event)
  }

  const on_pointer_up = event => {
    pressed = false
    on_pointerup(event)
  }

  const on_pointer_leave = event => {
    pressed = false
    on_pointerleave(event)
  }

  // The composable only move-cancels touch; flag a mouse orbit-drag so releasing it
  // doesn't open the menu.
  const on_pointer_move = event => {
    handle_pointermove(event)
    if (pressed) mark_moving()
    if (event.pointerType === 'touch' || was_orbit.value) return
    const dx = Math.abs(event.clientX - orbit_down_x)
    const dy = Math.abs(event.clientY - orbit_down_y)
    if (dx > ORBIT_MOVE_CANCEL_PX || dy > ORBIT_MOVE_CANCEL_PX)
      was_orbit.value = true
  }

  const canvas_ref = ref(null)
  const surface_ref = ref(null)
  /** @type {import('vue').Ref<PosterSceneController | null>} */
  const scene_ref = ref(null)
  let viewer = null
  /** @type {(() => void) | null} */
  let unregister_live_scene = null
  /** @type {(() => void) | null} */
  let release_live_texture = null
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

    viewer = register_viewer(
      canvas_ref.value,
      scene_controller,
      surface_ref.value ?? canvas_ref.value
    )
    viewer.start_enter(props.on_svg_zoom)
    scene_ref.value = scene_controller
    // Track B experiment: when the origin-trial feature is present and the
    // user has opted in, let the running SVG morph show on the front shadow
    // layer instead of its baked still. Inert anywhere else.
    if (live_texture_3d.value)
      release_live_texture = attach_live_poster_texture({
        element: svg_el,
        scene: scene_controller.scene
      })

    unregister_live_scene = register_live_poster_scene(
      /** @type {Id} */ (props.itemid),
      scene_controller
    )
  })

  before_unmount(() => {
    mount_active = false
    if (settle_timer !== null) clearTimeout(settle_timer)
    settle_timer = null
    release_live_texture?.()
    release_live_texture = null
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
  <div
    ref="surface_ref"
    class="viewer-3d"
    :data-ios="is_ios() || undefined"
    :data-moving="moving || undefined"
    @pointerdown="on_pointer_down"
    @pointermove="on_pointer_move"
    @pointerup="on_pointer_up"
    @pointercancel="on_pointer_leave"
    @pointerleave="on_pointer_leave"
    @contextmenu.prevent
    @selectstart.prevent>
    <canvas ref="canvas_ref" />
  </div>
</template>

<style lang="stylus">
  .viewer-3d {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    disable-ios-touch-callout();

    & > canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      disable-ios-touch-callout();
    }

    &[data-ios] > canvas {
      pointer-events: none;
    }
  }
</style>
