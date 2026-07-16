<script setup>
  import {
    ref,
    computed,
    onMounted as mounted,
    watch,
    nextTick as tick,
    inject
  } from 'vue'
  import { collect_geology_paths } from '@/utils/geology'
  import { geology_layers } from '@/use/poster'
  import { subject_hue } from '@/use/mask-pen'

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

  const paths_by_key = computed(
    () => new Map(paths_data.value.map(p => [p.key, p]))
  )

  // Every subject's cells, coloured by the subject's hue; the active subject reads brighter.
  const subject_overlays = computed(() => {
    const subjects = mask_pen?.subjects.value ?? []
    const active_id = mask_pen?.active_subject_id.value
    const by_key = paths_by_key.value
    return subjects.map((subject, index) => ({
      id: subject.id,
      active: subject.id === active_id,
      hue: subject_hue(index),
      paths: [...subject.keys].map(key => by_key.get(key)).filter(path => path)
    }))
  })

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

  const layer_band = key => {
    const band = geology_layers.indexOf(key.split(':')[0])
    return band === -1 ? 0 : band
  }

  const active_hue = computed(() => {
    const subjects = mask_pen?.subjects.value ?? []
    const index = subjects.findIndex(
      s => s.id === mask_pen?.active_subject_id.value
    )
    return subject_hue(index < 0 ? subjects.length : index)
  })

  // Tap seeds a cell; drag grows a circle from the seed and floods to nearby cells
  // within TONE_TOLERANCE luminosity bands of the seed — so it spreads through an
  // object and stops where the tone changes. A second finger is pinch-zoom.
  const DRAG_START_PX = 4
  const TONE_TOLERANCE = 1
  const active_touches = new Set()
  let pinching = false
  let pending = false
  let growing = false
  let seed_key = null
  let seed_band = 0
  const seed_client = { x: 0, y: 0 }
  /** Cell centroids in client space, snapshotted at press. */
  let centroids = []
  const preview_keys = ref(new Set())
  /** The grow radius affordance, in poster user units, or null. */
  const grow_circle = ref(null)
  // Press a cell already in the active subject to grow-erase; otherwise grow-add.
  const erasing = ref(false)

  const preview_paths = computed(() => {
    const by_key = paths_by_key.value
    return [...preview_keys.value].map(key => by_key.get(key)).filter(p => p)
  })

  const preview_fill = computed(() =>
    erasing.value
      ? 'hsla(0, 0%, 55%, 0.35)'
      : `hsla(${active_hue.value}, 75%, 58%, 0.4)`
  )
  const preview_stroke = computed(() =>
    erasing.value
      ? 'hsla(0, 75%, 62%, 0.95)'
      : `hsla(${active_hue.value}, 85%, 65%, 0.9)`
  )

  const snapshot_centroids = () => {
    const svg = mask_pen_root.value?.ownerSVGElement
    if (!svg) return (centroids = [])
    const pt = svg.createSVGPoint()
    centroids = hit_paths.value.map(({ key, el }) => {
      const box = el.getBBox()
      const ctm = el.getScreenCTM()
      pt.x = box.x + box.width / 2
      pt.y = box.y + box.height / 2
      const point = ctm ? pt.matrixTransform(ctm) : { x: 0, y: 0 }
      return { key, cx: point.x, cy: point.y, band: layer_band(key) }
    })
  }

  const to_user = (client_x, client_y) => {
    const svg = mask_pen_root.value?.ownerSVGElement
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0, scale: 1 }
    const pt = svg.createSVGPoint()
    pt.x = client_x
    pt.y = client_y
    const user = pt.matrixTransform(ctm.inverse())
    return { x: user.x, y: user.y, scale: ctm.a || 1 }
  }

  const grow_from_seed = radius_client => {
    const keys = new Set()
    const r2 = radius_client * radius_client
    if (erasing.value) {
      // Erase every active-subject cell inside the circle, regardless of tone.
      const selected = mask_pen?.selected.value ?? new Set()
      for (const cell of centroids) {
        if (!selected.has(cell.key)) continue
        const dx = cell.cx - seed_client.x
        const dy = cell.cy - seed_client.y
        if (dx * dx + dy * dy <= r2) keys.add(cell.key)
      }
      return keys
    }
    if (seed_key) keys.add(seed_key)
    for (const cell of centroids) {
      if (Math.abs(cell.band - seed_band) > TONE_TOLERANCE) continue
      const dx = cell.cx - seed_client.x
      const dy = cell.cy - seed_client.y
      if (dx * dx + dy * dy <= r2) keys.add(cell.key)
    }
    return keys
  }

  const reset_grow = () => {
    pending = false
    growing = false
    seed_key = null
    erasing.value = false
    preview_keys.value = new Set()
    grow_circle.value = null
    if (mask_pen) mask_pen.painting.value = false
  }

  const on_pointer_down = event => {
    if (event.pointerType === 'touch') {
      active_touches.add(event.pointerId)
      if (active_touches.size > 1) {
        pinching = true
        reset_grow()
        if (capture_rect.value?.hasPointerCapture?.(event.pointerId))
          capture_rect.value.releasePointerCapture(event.pointerId)
        return
      }
    }
    if (pinching) return
    capture_rect.value?.setPointerCapture(event.pointerId)
    pending = true
    growing = false
    seed_key = key_at(event.clientX, event.clientY)
    seed_band = seed_key ? layer_band(seed_key) : 0
    erasing.value = !!(seed_key && mask_pen?.selected.value.has(seed_key))
    seed_client.x = event.clientX
    seed_client.y = event.clientY
    snapshot_centroids()
    preview_keys.value = new Set(seed_key ? [seed_key] : [])
  }

  const on_pointer_move = event => {
    if (pinching || active_touches.size > 1) return
    if (!pending) {
      if (mask_pen)
        mask_pen.hovered_key.value = key_at(event.clientX, event.clientY)
      return
    }
    const radius = Math.hypot(
      event.clientX - seed_client.x,
      event.clientY - seed_client.y
    )
    if (!growing && radius < DRAG_START_PX) return
    growing = true
    if (mask_pen) mask_pen.painting.value = true
    preview_keys.value = grow_from_seed(radius)
    const center = to_user(seed_client.x, seed_client.y)
    grow_circle.value = { cx: center.x, cy: center.y, r: radius / center.scale }
  }

  const on_pointer_up = event => {
    if (event.pointerType === 'touch') active_touches.delete(event.pointerId)
    if (capture_rect.value?.hasPointerCapture?.(event.pointerId))
      capture_rect.value.releasePointerCapture(event.pointerId)
    const commit = !pinching && pending
    if (commit && growing && erasing.value)
      mask_pen?.remove_members(preview_keys.value)
    else if (commit && growing) mask_pen?.add_members(preview_keys.value)
    else if (commit && seed_key) mask_pen?.toggle_path(seed_key)
    reset_grow()
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

    const figure = mask_pen_root.value?.closest(
      'figure:has([itemtype="/posters"])'
    )
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

  mounted(load_paths)
  watch(() => props.itemid, load_paths)
  watch(
    () => symbols_ready?.value,
    ready => {
      if (ready) load_paths()
    }
  )
</script>

<template>
  <g ref="mask_pen_root" data-mask-pen>
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
      data-mask-pen="hover"
      pointer-events="none" />
    <template v-for="overlay in subject_overlays" :key="overlay.id">
      <path
        v-for="p in overlay.paths"
        :key="`${overlay.id}-${p.key}`"
        :d="p.d"
        :transform="p.transform"
        data-mask-pen="selected"
        :style="{
          fill: `hsla(${overlay.hue}, 70%, 55%, ${overlay.active ? 0.5 : 0.3})`,
          stroke: `hsla(${overlay.hue}, 80%, 62%, ${overlay.active ? 0.95 : 0.6})`
        }"
        pointer-events="none" />
    </template>
    <path
      v-for="p in preview_paths"
      :key="`grow-${p.key}`"
      :d="p.d"
      :transform="p.transform"
      data-mask-pen="preview"
      :style="{ fill: preview_fill, stroke: preview_stroke }"
      pointer-events="none" />
    <circle
      v-if="grow_circle"
      :cx="grow_circle.cx"
      :cy="grow_circle.cy"
      :r="grow_circle.r"
      data-mask-pen="radius"
      :style="{ stroke: preview_stroke }"
      pointer-events="none" />
  </g>
</template>

<style>
  g[data-mask-pen] {
    /* Keep outlines hairline-thin so they don't swamp small geology cells; the fill
       is what tells you a cell is hovered (light) vs selected (solid). */
    path[data-mask-pen='hover'] {
      fill: color-mix(in srgb, var(--slate-fill) 30%, transparent);
      stroke: color-mix(in srgb, var(--slate-fill) 85%, transparent);
      stroke-width: calc(var(--base-line) * 0.035);
      vector-effect: non-scaling-stroke;
    }
    path[data-mask-pen='selected'] {
      fill: color-mix(in srgb, var(--slate-fill) 55%, transparent);
      stroke: color-mix(in srgb, var(--slate-fill) 95%, transparent);
      stroke-width: calc(var(--base-line) * 0.035);
      vector-effect: non-scaling-stroke;
    }
    path[data-mask-pen='preview'] {
      stroke-width: calc(var(--base-line) * 0.05);
      vector-effect: non-scaling-stroke;
    }
    circle[data-mask-pen='radius'] {
      fill: none;
      stroke-width: calc(var(--base-line) * 0.06);
      stroke-dasharray: calc(var(--base-line) * 0.2)
        calc(var(--base-line) * 0.15);
      vector-effect: non-scaling-stroke;
    }
  }
</style>
