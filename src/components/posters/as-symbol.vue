<script setup>
  /* eslint-disable vue/no-v-html */
  import { ref, onMounted as mounted, watch } from 'vue'
  import { load } from '@/utils/itemid'
  import { hydrate } from '@/utils/item'
  import { get } from 'idb-keyval'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    }
  })

  const element = ref(null)
  const symbol_content = ref('')
  const symbol_id = ref('')
  const symbol_viewbox = ref('')

  const load_symbol = async () => {
    await load(props.itemid)
    const html_string = await get(props.itemid)
    if (!html_string) return

    const fragment = hydrate(html_string)
    if (!fragment) return
    const loaded = fragment.querySelector(`[itemid="${props.itemid}"]`)
    if (loaded) {
      symbol_content.value = loaded.innerHTML
      symbol_id.value = loaded.id || props.itemid
      symbol_viewbox.value = loaded.getAttribute('viewBox') || ''
    }
  }

  mounted(load_symbol)
  watch(() => props.itemid, load_symbol)
</script>

<template>
  <!-- SVG content from app's own IndexedDB storage, trusted source -->
  <symbol
    ref="element"
    :id="symbol_id"
    v-bind:viewBox="symbol_viewbox || undefined"
    :itemid="itemid"
    v-html="symbol_content" />
</template>
