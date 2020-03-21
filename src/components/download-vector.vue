<template lang="html">
  <a :href="downloadable" :download='vector_name'>
    <icon name="download"></icon>
  </a>
</template>
<script>
  import date_helper from '@/helpers/date'
  import profile_helper from '@/helpers/profile'
  import icon from '@/components/icon'
  export default {
    components: { icon },
    props: {
      vector: {
        type: Object,
        required: true
      }
    },
    computed: {
      downloadable() {
        const svg = `<svg viewBox="${this.vector.view_box}" xmlns="http://www.w3.org/2000/svg">${this.vector.path}</svg>`
        return `data:application/octet-stream,${encodeURIComponent(svg)}`
      }
    },
    methods: {
      async vector_name() {
        const info = this.vector.id.split('/')
        const author_id = `${info[0]}`
        const type = `${info[1]}`
        const time = date_helper.as_day_and_time(Number(info[2]))
        const creator = await profile_helper.load(author_id)
        const name = `${creator.first_name}_${creator.last_name}`
        return `${name}_${type}_${time}.svg`
      }
    }
  }
</script>
