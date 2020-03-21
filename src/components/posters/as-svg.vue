<template lang="html">
  <svg class="poster" @click="vector_click">
    <defs v-if="vector" itemprop="view_box">{{vector.view_box}}</defs>
    <defs>
      <symbol v-if="vector" :id="id"
              :viewBox="vector.view_box"
              :preserveAspectRatio="aspect_ratio"
              v-html="vector.path"></symbol>
    </defs>
    <use :href="background" class='background'/>
    <use :href="vector_link"/>
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
      working: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data() {
      return {
        vector: null
      }
    },
    computed: {
      id() {
        return itemid.as_query_id(this.itemid)
      },
      fragment_id() {
        return itemid.as_fragment_id(this.itemid)
      },
      vector_link() {
        if (this.working) return `${icons}#working`
        if (this.poster) return this.as_fragment_id()
        else return `${icons}#mock-poster`
      },
      background() {
        return `${icons}#background`
      }
    },
    methods: {
      first_instance() {
        if (document.getElementById(this.id)) return false
        else return true
      },
      async show() {
        console.log('show', this.itemid)
        if (this.first_instance()) {
          this.poster = await itemid.load(this.vector.id)
          if (this.poster) this.$emit('vector-loaded', this.poster.id)
        }
      }
    }
  }
</script>
<style lang="stylus">
  svg.poster
    display: block
    height: 100%
    width: 100%
    max-height: poster-feed-height
    .background
      fill: green
</style>
