<template>
  <a :href="content" :download="file_name" class="download" @click="download">
    <icon name="download" />
  </a>
</template>
<script>
  import { as_day_and_time } from '@/use/date'
  import hsl_to_hex from 'hsl-to-hex'
  import { hsla_to_color } from '@/use/colors'
  import { load, as_query_id } from '@/use/itemid'
  import { is_vector_id } from '@/use/vector'
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
        content: '',
        vector: {},
        file_name: null
      }
    },
    async created() {
      this.file_name = await this.get_vector_name()
    },
    methods: {
      download() {
        const svg = document.getElementById(as_query_id(this.itemid))
        if (localStorage.adobe) {
          const convert = svg.querySelectorAll('[stop-color]')
          convert.forEach(element => {
            const hsla = element.getAttribute('stop-color')
            const c = hsla_to_color(hsla)
            element.setAttribute('stop-color', hsl_to_hex(c.h, c.s, c.l))
          })
        }
        if (!svg) return

        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        this.content = `data:application/octet-stream,${encodeURIComponent(
          svg.outerHTML
        )}`
      },
      async get_vector_name() {
        const info = this.itemid.split('/')
        const author_id = `/${info[1]}`
        const time = as_day_and_time(Number(info[3]))
        const creator = await load(author_id)
        const facts = `${time}.svg`
        if (creator)
          return `${creator.first_name}_${creator.last_name}_${facts}`
        else return facts
      }
    }
  }
</script>
