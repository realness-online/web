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
  import itemid from '@/helpers/itemid'
  import intersection from '@/mixins/intersection'
  import vector_click from '@/mixins/vector_click'
  export default {
    mixins: [intersection, vector_click],
    props: {
      itemid: {
        type: String,
        required: true
      },
      new_poster: {
        type: Object,
        required: false,
        default: null
      }
    },
    data () {
      return {
        vector: null
      }
    },
    computed: {
      viewbox () {
        if (this.vector) return this.vector.viewbox
        else return '0 0 0 0'
      },
      path () {
        if (this.vector) return this.vector.path
        else return ''
      }
    },
    methods: {
      async show () {
        if (this.vector) return
        if (this.new_poster) this.vector = this.new_poster
        else this.vector = await itemid.load(this.itemid)
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
