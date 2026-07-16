<script setup>
  /* eslint-disable vue/no-v-html */
  import {
    ref,
    shallowRef as shallow_ref,
    onMounted as mounted,
    watch
  } from 'vue'
  import { load_from_cache } from '@/utils/itemid'
  import { hydrate } from '@/utils/item'
  import { get } from 'idb-keyval'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    }
  })

  const element = ref(null)
  const symbol_content = shallow_ref('')
  const symbol_id = ref('')
  const symbol_viewbox = ref('')
  const load_token = ref(0)

  const load_symbol = async () => {
    const token = ++load_token.value
    const itemid_at_start = props.itemid
    let html_string = await get(itemid_at_start)
    if (!html_string) {
      const { html } = await load_from_cache(itemid_at_start)
      if (!html) return
      html_string = html
    }
    if (load_token.value !== token) return

    const fragment = hydrate(html_string)
    if (!fragment) return
    const loaded = fragment.querySelector(`[itemid="${itemid_at_start}"]`)
    if (loaded) {
      symbol_content.value = loaded.innerHTML
      symbol_id.value = loaded.id || itemid_at_start
      symbol_viewbox.value = loaded.getAttribute('viewBox') || ''
    }
  }

  mounted(load_symbol)
  watch(
    () => props.itemid,
    () => {
      symbol_content.value = ''
      load_symbol()
    }
  )
</script>

<template>
  <symbol
    ref="element"
    :id="symbol_id"
    v-bind:viewBox="symbol_viewbox || undefined"
    :itemid="itemid"
    v-html="symbol_content" />
</template>
