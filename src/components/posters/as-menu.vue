<template lang="html">
  <menu>
    <a @click="$emit('remove-poster')">
      <icon v-if="working" name="working"></icon>
      <icon v-else name="remove"></icon>
    </a>
    <a id="create-event" v-if="!is_new">
      <svg viewBox="0 0 150 150" :class="has_event">
        <use :href="date_picker_icon"/>
        <text class="month" x="57" y="24" text-anchor="middle">{{month}}</text>
        <text x="57" y="84" text-anchor="middle">{{day}}</text>
      </svg>
    </a>
    <a @click="$emit('add-poster')" v-if="is_new">
      <icon v-if="accept" name="finished"></icon>
      <icon v-else name="working"></icon>
    </a>
    <download-vector v-if="!is_new" :vector="poster"></download-vector>
  </menu>
</template>
<script>
  import icon from '@/components/icon'
  import icons from '@/icons.svg'
  import download_vector from '@/components/download-vector'
  export default {
    components: {
      icon,
      'download-vector': download_vector
    },
    props: {
      working: {
        type: Boolean,
        required: false,
        default: false
      },
      is_new: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    data () {
      return {
        accept: true
      }
    },
    created () {
      console.log('what the fuck', this.is_new)
    },
    computed: {
      date_picker_icon () {
        return `${icons}#date-picker`
      }
    }
  }
</script>
<style lang="stylus">
  figure.poster
    & > figcaption > menu
      padding: base-line
      margin-top: -(base-line * 4)
      display: flex
      justify-content: space-between
      width: 100%
      z-index: 4
      & > a#create-event
        position: relative
        svg
          &.has-event
            fill: blue
          text
            fill: white
            font-size: base-line * 2
          text.month
            font-size: (base-line / 2)
            font-weight: 900
          rect, path
            stroke: darken(black, 5%)
            stroke-width: 0.5px
      & > a > svg
        fill: red
        &.finished
        &.add
          fill: blue
</style>
