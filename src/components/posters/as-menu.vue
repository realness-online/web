<template lang="html">
  <menu v-if="menu">
    <a @click="remove_poster">
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
    <a @click="add_poster" v-if="is_new">
      <icon v-if="accept" name="finished"></icon>
      <icon v-else name="working"></icon>
    </a>
    <download-vector v-if="!is_new" :vector="poster"></download-vector>
  </menu>
</template>
<script>
  import icons from '@/icons.svg'
  import download_vector from '@/components/download-vector'
  export default {
    components: {
      'download-vector': download_vector
    },
    computed: {
      date_picker_icon () {
        return `${icons}#date-picker`
      }
    }
  }
</script>
<style lang="stylus">
</style>
