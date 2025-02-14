<script>
  import { as_day_and_time } from '@/utils/date'
  import hsl_to_hex from 'hsl-to-hex'
  import { hsla_to_color } from '@/utils/colors'
  import { load, as_query_id } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  import icon from '@/components/icon'
  export default {
    components: { icon },
    props: {
      itemid: {
        type: String,
        required: true,
        validator: is_vector_id
      }
    },
    data() {
      return {
        content: null,
        vector: {},
        file_name: null
      }
    },
    async mounted() {
      this.file_name = await this.get_vector_name()
    },
    methods: {
      download() {
        this.working = false
        const svg = document.getElementById(as_query_id(this.itemid))
        if (!svg) return
        if (localStorage.adobe) this.adobe(svg)
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        this.content = `data:application/octet-stream,${encodeURIComponent(svg.outerHTML)}`
      },
      adobe(svg) {
        const convert = svg.querySelectorAll('[stop-color]')
        convert.forEach(element => {
          const hsla = element.getAttribute('stop-color')
          const c = hsla_to_color(hsla)
          element.setAttribute('stop-color', hsl_to_hex(c.h, c.s, c.l))
        })
      },
      async get_vector_name() {
        const info = this.itemid.split('/')
        const author_id = `/${info[1]}`
        const time = as_day_and_time(Number(info[3]))
        const creator = await load(author_id)
        const facts = `${time}.svg`
        if (creator?.first_name)
          return `${creator.first_name}-${creator.last_name}, ${facts}`
        return facts
      }
    }
  }
</script>

<template>
  <a :href="content" :download="file_name" class="download" @click="download">
    <icon name="download" />
  </a>
</template>

<style lang="stylus">
  a.download.working
    animation-name: working
</style>
