<template>
  <a :href="downloadable" :download="file_name" class="download">
    <icon name="download" />
  </a>
</template>
<script>
  import { as_day_and_time } from '@/use/date'
  import { load } from '@/use/itemid'
  import icon from '@/components/icon'
  export default {
    components: { icon },
    props: {
      itemid: {
        type: String,
        required: true
      }
    },
    data() {
      return {
        vector: {},
        file_name: null
      }
    },
    computed: {
      downloadable() {
        const svg = `<svg viewBox="${this.vector.viewbox}" xmlns="http://www.w3.org/2000/svg">${this.vector.path}</svg>`
        return `data:application/octet-stream,${encodeURIComponent(svg)}`
      }
    },
    async created() {
      this.vector = await load(this.itemid)
      this.file_name = await this.get_vector_name()
    },
    methods: {
      async get_vector_name() {
        const info = this.itemid.split('/')
        const author_id = `/${info[1]}`
        const type = `${info[2]}`
        const time = as_day_and_time(Number(info[3]))
        const creator = await load(author_id)
        const facts = `${type}_${time}.svg`
        if (creator)
          return `${creator.first_name}_${creator.last_name}_${facts}`
        else return facts
      }
    }
  }
</script>
