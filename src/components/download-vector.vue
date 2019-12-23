<template lang="html">
  <a :href="downloadable" :download='vector_name'>
    <icon name="download"></icon>
  </a>
</template>
<script>
  import date_helper from '@/helpers/date'
  import icon from '@/components/icon'
  export default {
    components: { icon },
    props: {
      vector: {
        type: Object,
        required: true
      },
      author: {
        type: Object,
        required: true
      }
    },
    computed: {
      vector_name() {
        const type = this.vector.type.split('/')[1]
        const time = date_helper.as_day_and_time(Number(this.vector.created_at))    
        const name = `${this.author.first_name}_${this.author.last_name}`
        return `${name}_${type}_${time}.svg`
      },
      downloadable() {
        const svg = `<svg viewBox="${this.vector.view_box}" xmlns="http://www.w3.org/2000/svg">${this.vector.path}</svg>`
        return `data:application/octet-stream,${encodeURIComponent(svg)}`
      }
    }
  }
</script>
