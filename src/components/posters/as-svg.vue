<template lang="html">
  <svg :itemid="itemid" itemscope itemtype="/posters"
       :viewBox="viewbox" :preserveAspectRatio="aspect_ratio" @click="vector_click">
    <g v-for="(symbol, index) in path" :key="index">
      <symbol :id="symbol_id(index)" :viewBox="viewbox" v-html="symbol" />
      <use :href="symbol_fragment(index)" />
    </g>
    <defs v-if="vector && vector.animation" v-html="vector.animation.go" />
  </svg>
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
    watch: {
      poster () {
        if (this.poster) this.vector = this.poster
      }
    },
    methods: {
      async show () {
        if (this.vector) return
        if (this.poster) this.vector = this.poster
        else this.vector = await load(this.itemid)
        await this.$nextTick()
        this.$emit('vector-loaded', this.vector)
        this.vector.animation = await load()
        console.log(this.vector.animation.id)
        this.$emit('animation-loaded', this.vector.animation)
      }
    }
  }
</script>
<style lang="stylus">
  svg[itemtype="/posters"]
    display: block
    height: 100%
    width: 100%
</style>
