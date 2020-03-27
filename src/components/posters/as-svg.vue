<template lang="html">
  <svg itemscope :class="action" itemtype="posters" :itemid="itemid" @click="vector_click">
    <defs v-if="vector" itemprop="view_box">{{vector.view_box}}</defs>
    <symbol v-if="vector" :id="id"
            :preserveAspectRatio="aspect_ratio"
            :viewBox="vector.view_box" v-html="vector.path"></symbol>
    <use :href="background_link" :class='background'/>
    <use v-if="vector" :href="as_fragment_id"/>
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
      }
    },
    methods: {
      first_instance () {
        if (document.getElementById(this.id)) return false
        else return true
      },
      async show () {
        if (this.first_instance()) {
          // console.log('first_instance', this.new_poster)
          if (this.new_poster) this.vector = this.new_poster
          else this.vector = await itemid.load(this.itemid)
          if (this.vector) this.$emit('vector-loaded', this.vector.id)
        }
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
