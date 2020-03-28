<template lang="html">
  <a :href="downloadable" :download="file_name">
    <icon name="download"></icon>
  </a>
</template>
<script>
  import date_helper from '@/helpers/date'
  import profile_helper from '@/helpers/profile'
  import itemid from '@/helpers/itemid'
  import icon from '@/components/icon'
  export default {
    components: { icon },
    props: {
      itemid: {
        type: String,
        required: true
      }
    },
    data () {
      return {
        vector: {},
        file_name: null
      }
    },
    async created () {
      this.file_name = await this.get_vector_name()
      this.vector = await itemid.load(this.itemid)
    },
    computed: {
      downloadable () {
        console.log(this.vector)
        const svg = `<svg viewBox="${this.vector.view_box}" xmlns="http://www.w3.org/2000/svg">${this.vector.path}</svg>`
        return `data:application/octet-stream,${encodeURIComponent(svg)}`
      }
    },
    methods: {
      async get_vector_name () {
        console.log(this.itemid)
        const info = this.itemid.split('/')
        const author_id = `/${info[1]}`
        const type = `${info[2]}`
        const time = date_helper.as_day_and_time(Number(info[3]))
        const creator = await profile_helper.load(author_id)
        const name = `${creator.first_name}_${creator.last_name}`
        return `${name}_${type}_${time}.svg`
      }
    }
  }
</script>
