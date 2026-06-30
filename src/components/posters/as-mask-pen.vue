<script setup>
  import {
    ref,
    computed,
    onMounted,
    watch,
    nextTick as tick,
    inject
  } from 'vue'
  import { collect_geology_paths } from '@/utils/geology'

  const props = defineProps({
    itemid: { type: String, required: true }
  })

  const mask_pen = inject('mask-pen', null)
  const symbols_ready = inject('mask-pen-symbols-ready', null)

  const mask_pen_root = ref(null)
  const hit_layer = ref(null)
  const capture_rect = ref(null)
  const overlay = ref({ x: 0, y: 0, width: 1, height: 1 })
  const paths_data = ref([])
  /** @type {import('vue').Ref<{ key: string, el: SVGPathElement }[]>} */
  const hit_paths = ref([])

  const hovered_path = computed(() =>
    paths_data.value.find(p => p.key === mask_pen?.hovered_key.value)
  )

  const selected_paths = computed(() =>
    paths_data.value.filter(p => mask_pen?.selected.value.has(p.key))
  )

  const key_at = (clientX, clientY) => {
    const svg = mask_pen_root.value?.ownerSVGElement
    if (!svg || !hit_paths.value.length) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    for (let i = hit_paths.value.length - 1; i >= 0; i--) {
      const { key, el } = hit_paths.value[i]
      const ctm = el.getScreenCTM()
      if (!ctm) continue
      const local = pt.matrixTransform(ctm.inverse())
      if (el.isPointInFill(local)) return key
    }
    return null
  }

  // One finger paints; a second finger is a pinch-zoom — hand it to the browser
  // (touch-action: pinch-zoom) and never paint during it. Selection is deferred:
  // it commits only on a clean tap (release) or once a drag clearly starts, so a
  // pinch — where the second finger lands a moment after the first — never selects.
  const DRAG_START_PX = 4
  const active_touches = new Set()
  let pinching = false
  let pending = false
  let stroke_started = false
  let pending_key = null
  let down_x = 0
  let down_y = 0

  const reset_pending = () => {
    pending = false
    stroke_started = false
    pending_key = null
  }

  const on_pointer_down = event => {
    if (event.pointerType === 'touch') {
      active_touches.add(event.pointerId)
      if (active_touches.size > 1) {
        pinching = true
        if (stroke_started) mask_pen?.handle_pointerup()
        reset_pending()
        if (capture_rect.value?.hasPointerCapture?.(event.pointerId))
          capture_rect.value.releasePointerCapture(event.pointerId)
        return
      }
    }
    if (pinching) return
    capture_rect.value?.setPointerCapture(event.pointerId)
    pending = true
    stroke_started = false
    pending_key = key_at(event.clientX, event.clientY)
    down_x = event.clientX
    down_y = event.clientY
  }

  const on_pointer_move = event => {
    if (pinching || active_touches.size > 1 || !pending) return
    if (!stroke_started) {
      const dx = Math.abs(event.clientX - down_x)
      const dy = Math.abs(event.clientY - down_y)
      if (dx < DRAG_START_PX && dy < DRAG_START_PX) return
      stroke_started = true
      mask_pen?.handle_pointerdown(pending_key)
    }
    mask_pen?.handle_pointermove(key_at(event.clientX, event.clientY))
  }

  const on_pointer_up = event => {
    if (event.pointerType === 'touch') active_touches.delete(event.pointerId)
    if (capture_rect.value?.hasPointerCapture?.(event.pointerId))
      capture_rect.value.releasePointerCapture(event.pointerId)
    const commit = !pinching && pending
    if (commit && stroke_started) mask_pen?.handle_pointerup()
    else if (commit) {
      // Clean tap: toggle the cell under the finger on release.
      mask_pen?.handle_pointerdown(pending_key)
      mask_pen?.handle_pointerup()
    }
    reset_pending()
    if (active_touches.size === 0) pinching = false
  }

  const load_paths = async () => {
    await tick()
    const svg = mask_pen_root.value?.ownerSVGElement
    const vb = svg?.viewBox?.baseVal
    if (vb)
      overlay.value = {
        x: vb.x,
        y: vb.y,
        width: vb.width,
        height: vb.height
      }

    const figure = mask_pen_root.value?.closest('figure.poster')
    const symbol_defs = figure?.querySelector('svg[data-poster-symbol-defs]')
    const paths = collect_geology_paths(symbol_defs, props.itemid)
    paths_data.value = paths

    const layer = hit_layer.value
    if (!layer || typeof document === 'undefined') {
      hit_paths.value = []
      return
    }

    layer.replaceChildren()
    hit_paths.value = paths.map(p => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      el.setAttribute('d', p.d)
      if (p.transform) el.setAttribute('transform', p.transform)
      layer.appendChild(el)
      return { key: p.key, el }
    })
  }

  onMounted(load_paths)
  watch(() => props.itemid, load_paths)
  watch(
    () => symbols_ready?.value,
    ready => {
      if (ready) load_paths()
    }
  )
</script>

<template>
  <g ref="mask_pen_root" class="mask-pen">
    <g
      ref="hit_layer"
      visibility="hidden"
      pointer-events="none"
      aria-hidden="true" />
    <rect
      ref="capture_rect"
      :x="overlay.x"
      :y="overlay.y"
      :width="overlay.width"
      :height="overlay.height"
      fill="transparent"
      pointer-events="all"
      @pointerdown.stop="on_pointer_down"
      @pointermove="on_pointer_move"
      @pointerup.stop="on_pointer_up"
      @pointerleave.stop="on_pointer_up"
      @pointercancel.stop="on_pointer_up" />
    <path
      v-if="
        hovered_path &&
        !mask_pen?.selected.value.has(mask_pen?.hovered_key.value)
      "
      :d="hovered_path.d"
      :transform="hovered_path.transform"
      class="mask-pen-hover"
      pointer-events="none" />
    <path
      v-for="p in selected_paths"
      :key="`sel-${p.key}`"
      :d="p.d"
      :transform="p.transform"
      class="mask-pen-selected"
      pointer-events="none" />
  </g>
</template>

<style lang="stylus">
  g.mask-pen
    // Keep outlines hairline-thin so they don't swamp small geology cells; the fill
    // is what tells you a cell is hovered (light) vs selected (solid).
    path.mask-pen-hover
      fill: alpha(yellow, 0.3)
      stroke: alpha(yellow, 0.85)
      stroke-width: base-line * 0.035
      vector-effect: non-scaling-stroke
    path.mask-pen-selected
      fill: alpha(orange, 0.55)
      stroke: alpha(orange, 0.95)
      stroke-width: base-line * 0.035
      vector-effect: non-scaling-stroke
</style>
