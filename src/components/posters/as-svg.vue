<template lang="html">
  <svg
    itemscope
    itemtype="/posters"
    :itemid="itemid"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio"
    @click="vector_click"
    v-html="path" />
</template>
<script>
  import { load } from '@/helpers/itemid'
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  import vector from '@/mixins/vector'
  export default {
    mixins: [intersection, vector_click, vector],
    props: {
      itemid: {
        type: String,
        required: true
      },
      poster: {
        type: Object,
        required: false,
        default: null
      }
    },
    computed: {
      viewbox () {
        if (this.vector) return this.vector.viewbox
        else return '0 0 0 0'
      }
    },
    methods: {
      async show () {
        if (this.vector) return
        if (this.poster) this.vector = this.poster
        else this.vector = await load(this.itemid)
        await this.$nextTick()
        this.$emit('vector-loaded', this.itemid)
      }
    }
  }
</script>
<style lang="stylus">
  svg[itemtype="/posters"]
    display: block
    height: 100%
    width: 100%
    max-height: poster-feed-height
</style>
