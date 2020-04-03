<template lang="html">
  <svg itemscope itemtype="posters"
       :itemid="itemid"
       :viewBox="viewbox"
       :preserveAspectRatio="aspect_ratio"
       @click="vector_click"
       v-html="path">
  </svg>
</template>
<script>
  import itemid from '@/helpers/itemid'
  import vector_intersection from '@/mixins/vector_intersection'
  import vector_click from '@/mixins/vector_click'
  export default {
    mixins: [vector_intersection, vector_click],
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
        else return ''
      },
      path () {
        if (this.vector) return this.vector.path
        else return ''
      }
    },
    methods: {
      first_instance () {
        if (document.querySelector(`[itemid="${this.itemid}"]`)) return false
        else return true
      },
      async show () {
        if (this.vector) return
        if (this.new_poster) this.vector = this.new_poster
        else this.vector = await itemid.load(this.itemid)
        this.$emit('vector-loaded', this.vector.id)
      }
    }
  }
</script>
<style lang="stylus">
  svg[itemtype="posters"]
    display: block
    height: 100%
    width: 100%
    max-height: poster-feed-height
</style>
