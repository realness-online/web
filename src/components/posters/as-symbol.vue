<script setup>
import { ref, onMounted as mounted } from 'vue'
import { as_download_url } from '@/utils/itemid'
import { decompress_html } from '@/utils/upload-processor'
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
   console.log('as-symbol: loading itemid:', props.itemid)
  // Try local cache first (Large.save writes outerHTML to idb)
  let html_string = await get(props.itemid)

  // Fallback to network only if we have a public URL
  if (!html_string) {
    const download_url = await as_download_url(props.itemid)
    if (!download_url) return
    const response = await fetch(download_url)
    const content_encoding = response.headers.get('Content-Encoding')
    const compressed_html = await response.arrayBuffer()
    if (!content_encoding || content_encoding === 'identity')
      html_string = new TextDecoder().decode(compressed_html)
    else html_string = await decompress_html(compressed_html)
  }
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
