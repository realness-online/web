<template lang="html">
  <svg :itemid="itemid" itemscope itemtype="/posters"
       tabindex="0"
       :viewBox="viewbox" :preserveAspectRatio="aspect_ratio" @click="vector_click">
    <defs>
      <symbol v-for="(symbol, index) in path" :id="symbol_id(index)" :key="index" :viewBox="viewbox" v-html="symbol" />
      <symbol :id="all_id" :preserveAspectRatio="aspect_ratio" :viewBox="viewbox">
        <use v-for="(symbol, index) in path" :key="index" :href="symbol_fragment(index)" />
      </symbol>
    </defs>
    <use :href="all_fragment" :viewBox="viewbox" />
    <g v-if="animation" v-html="animation.go" />
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

        this.animation = await this.load_animation()
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
