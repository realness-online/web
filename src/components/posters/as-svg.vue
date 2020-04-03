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
  import icons from '@/icons.svg'
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
      id () {
        return itemid.as_query_id(this.itemid)
      },
      as_fragment_id () {
        return itemid.as_fragment(this.itemid)
      },
      background_link () {
        if (this.vector) return `${icons}#background`
        else return `${icons}#working`
      },
      background () {
        if (this.vector) return 'background'
        else return 'working'
      },
      action () {
        if (this.vector) return 'display'
        else return 'working'
      },
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
        console.log('first_instance', this.itemid)
        if (this.new_poster) this.vector = this.new_poster
        else this.vector = await itemid.load(this.itemid)
        console.log(this.vector)
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
    &.working
      max-width: base-line * 6
    .background
      fill: green
</style>
