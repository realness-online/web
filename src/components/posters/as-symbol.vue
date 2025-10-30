<script setup>
  import { ref, onMounted as mounted } from 'vue'
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

  mounted(async () => {
    await load(props.itemid) // make sure it cached
    const html_string = await get(props.itemid)
    if (!html_string) return

    const fragment = hydrate(html_string)
    if (!fragment) return
    const loaded = fragment.querySelector(`[itemid="${props.itemid}"]`)
    if (loaded && element.value) element.value.outerHTML = loaded.outerHTML
  })
</script>

<template>
  <symbol ref="element" />
</template>
