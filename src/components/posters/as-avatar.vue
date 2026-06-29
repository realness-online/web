<script setup>
  /** @typedef {import('@/types').Id} Id */
  import AsSvg from '@/components/posters/as-svg'
  import AsPosterSymbol from '@/components/posters/as-poster-symbol'
  import { ref, computed, watch, provide } from 'vue'
  import { useIntersectionObserver as use_intersect } from '@vueuse/core'
  import { use_poster_instance } from '@/use/poster-instances'
  import { poster_dom_id, poster_dom_href } from '@/use/poster-dom-reference'
  import { load_cutout_flags } from '@/utils/geology'

  // One poster can appear many times on a page (hero + avatars + duplicate rows). They share
  // page-global ids, so only one visible instance — the elected canonical — owns the
  // `<defs>`/`<symbol>`s; the rest reference it with `<use href="#…">`. When this avatar is the
  // canonical (no full poster visible) it renders its own symbol defs so it stands alone.
  const props = defineProps({
    itemid: {
      type: String,
      required: true
    },
    tabable: {
      type: Boolean,
      default: false
    },
    label: {
      type: String,
      default: 'Avatar'
    }
  })
  const emit = defineEmits(['show', 'click'])

  const root = ref(null)
  const el = computed(() => {
    const node = root.value
    if (!node) return null
    return node.$el ?? node
  })
  const in_view = ref(false)
  use_intersect(el, ([entry]) => {
    in_view.value = entry?.isIntersecting ?? false
  })

  const { use_reference } = use_poster_instance(() => props.itemid, {
    el,
    in_view,
    kind: 'avatar'
  })

  const reference_href = computed(() =>
    props.itemid ? poster_dom_href(/** @type {Id} */ (props.itemid)) : ''
  )
  const ref_viewbox = ref('0 0 16 16')
  const sync_reference = () => {
    if (typeof document === 'undefined' || !props.itemid) return
    const node = document.getElementById(
      poster_dom_id(/** @type {Id} */ (props.itemid))
    )
    if (node && node.tagName === 'svg') {
      const vb = node.getAttribute('viewBox')
      if (vb) ref_viewbox.value = vb
    }
  }
  watch(use_reference, on => {
    if (on) sync_reference()
  })

  // Cutout symbols (as-symbol → as-path-cutout) inject the nearest provided vector.
  const vector = ref(null)
  const shown = ref(false)
  provide('vector', vector)
  const on_show = async shown_vector => {
    if (!shown_vector) return
    vector.value = shown_vector
    if (!vector.value.cutouts && props.itemid)
      vector.value.cutouts = await load_cutout_flags(
        /** @type {Id} */ (props.itemid)
      )
    shown.value = true
    emit('show', shown_vector)
  }
</script>

<template>
  <svg
    v-if="use_reference"
    ref="root"
    aria-roledescription="referenced poster"
    role="img"
    :aria-label="label"
    :viewBox="ref_viewbox"
    preserveAspectRatio="xMidYMid slice"
    @click="emit('click', $event)">
    <use :href="reference_href" />
  </svg>
  <as-svg
    v-else
    ref="root"
    as_avatar
    :itemid="itemid"
    :tabable="tabable"
    @show="on_show"
    @click="emit('click', $event)" />
  <as-poster-symbol
    v-if="shown && !use_reference"
    :itemid="itemid"
    :vector="vector"
    :shown="shown" />
</template>
