<template lang="html">
  <figure class="events">
    <icon name="background" />
    <svg v-if="vector"
         :viewBox="vector.viewbox"
         :preserveAspectRatio="aspect_ratio"
         @click="vector_click"
         v-html="path" />
  </figure>
</template>
<script>
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import vector from '@/mixins/vector'
  import { load } from '@/helpers/itemid'
  import icon from '@/components/icon'
  export default {
    components: { icon },
    mixins: [intersection, vector_click, vector],
    props: {
      event: {
        type: Object,
        required: true
      }
    },
    methods: {
      async show () {
        this.vector = await load(this.event.url)
      }
    }
  }
</script>
<style lang="stylus">
  figure.events
    position: relative
    & > svg
      display: block
      height: 100%
      width: 100%
      &.background
        border: none
        @media (prefers-color-scheme: dark)
          fill: green
</style>
