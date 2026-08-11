<script setup>
  import { ref, computed, watch, onMounted as mounted, inject } from 'vue'
  import { as_query_id, as_fragment_id } from '@/utils/itemid'
  import { collect_geology_paths } from '@/utils/geology'
  import { read_subjects } from '@/utils/subjects'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    }
  })

  const mask_pen = inject('mask-pen', null)
  const symbols_ready = inject('mask-pen-symbols-ready', null)

  const root = ref(null)
  /** @type {import('vue').Ref<{ key: string, d: string, transform?: string }[]>} */
  const geometry = ref([])

  // Resolve the poster root's geology geometry once the cutout symbols mount.
  // Mirrors as-mask-pen: the poster <svg> is ownerSVGElement of our <g>, and
  // the per-layer symbols live in the figure's symbol-defs svg.
  const resolve_geometry = () => {
    const svg = root.value?.ownerSVGElement
    const figure = svg?.closest('figure:has([itemtype="/posters"])')
    const symbol_defs = figure?.querySelector('svg[data-poster-symbol-defs]')
    geometry.value =
      collect_geology_paths(
        symbol_defs,
        /** @type {import('@/types').Id} */ (props.itemid)
      ) ?? []
  }

  mounted(resolve_geometry)
  watch(
    () => symbols_ready?.value,
    ready => {
      if (ready) resolve_geometry()
    }
  )

  // One mask per subject, built in real time from the live subject list. Each
  // mask's content is the subject's cell paths (white reveal); the persisted
  // <metadata> list is the source of truth, restored here via read_subjects.
  // Prefer live subjects, but fall back to the persisted list when the live
  // list is empty (e.g. a fresh reload before the pen has mounted), so
  // reloaded posters show their masks immediately.
  const subject_masks = computed(() => {
    const svg = root.value?.ownerSVGElement
    const live = mask_pen?.subjects.value ?? []
    const persisted = read_subjects(
      svg,
      /** @type {import('@/types').Id} */ (props.itemid)
    )
    const subjects = live.length ? live : persisted
    const by_key = new Map(geometry.value.map(p => [p.key, p]))
    return subjects.map(subject => ({
      id: subject.id,
      paths: [...subject.keys].map(key => by_key.get(key)).filter(Boolean)
    }))
  })

  const query = add => {
    if (!props.itemid) return add
    if (add) return `${as_query_id(props.itemid)}-${add}`
    return as_query_id(props.itemid)
  }
  const as_url = add => `url(${as_fragment_id(props.itemid)}-${add})`
</script>

<template>
  <g ref="root">
    <mask
      :id="query('horizontal-mask')"
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse">
      <rect
        width="100%"
        height="100%"
        :fill="as_url('horizontal-background')" />
    </mask>
    <mask
      :id="query('radial-mask')"
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse">
      <rect width="100%" height="100%" :fill="as_url('radial-background')" />
    </mask>
    <mask
      :id="query('vertical-mask')"
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse">
      <rect width="100%" height="100%" :fill="as_url('vertical-background')" />
    </mask>
    <mask
      v-for="subject in subject_masks"
      :key="subject.id"
      :id="query(`subjects/${subject.id}`)"
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse">
      <path
        v-for="p in subject.paths"
        :key="p.key"
        :d="p.d"
        :transform="p.transform"
        fill="#fff" />
    </mask>
  </g>
</template>
