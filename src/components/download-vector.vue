<script setup>
  import { as_day_and_time } from '@/utils/date'
  import { hsl_to_hex } from '@/utils/color-converters'
  import { hsla_to_color } from '@/utils/colors'
  import { load, as_query_id } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  import icon from '@/components/icon'
  import { ref, onMounted } from 'vue'

  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    }
  })

  defineOptions({
    name: 'DownloadVector'
  })

  const content = ref(null)
  const file_name = ref(null)
  const working = ref(false)

  const download = () => {
    working.value = false
    const svg = document.getElementById(as_query_id(props.itemid))
    if (!svg) return
    if (localStorage.adobe) adobe(svg)
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    content.value = `data:application/octet-stream,${encodeURIComponent(svg.outerHTML)}`
  }

  const adobe = svg => {
    const convert = svg.querySelectorAll('[stop-color]')
    convert.forEach(element => {
      const hsla = element.getAttribute('stop-color')
      const c = hsla_to_color(hsla)
      element.setAttribute('stop-color', hsl_to_hex(c.h, c.s, c.l))
    })
  }

  const get_vector_name = async () => {
    const info = props.itemid.split('/')
    const author_id = `/${info[1]}`
    const time = as_day_and_time(Number(info[3]))
    const creator = await load(author_id)
    const facts = `${time}.svg`
    if (creator?.name) {
      const safe_name = creator.name.replace(/\s+/g, '_')
      return `${safe_name}_${facts}`
    }
    return facts
  }

  onMounted(async () => {
    file_name.value = await get_vector_name()
  })
</script>

<template>
  <a :href="content" :download="file_name" class="download" @click="download">
    <icon name="download" />
  </a>
</template>

<style lang="stylus">
  a.download.working {
    animation-name: working;
  }
</style>
