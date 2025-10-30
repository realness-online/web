<script setup>
import { ref, onMounted as mounted } from 'vue'
import { load } from '@/utils/itemid'

const props = defineProps({
  itemid: {
    type: String,
    required: true
  }
})

const element = ref(null)

mounted(async () => {
  console.log('as-symbol: loading itemid:', props.itemid)
  const symbol = await load(props.itemid, localStorage.me)
  if (symbol && element.value) element.value.outerHTML = symbol.innerHTML
})
</script>

<template>
  <symbol ref="element" />
</template>
