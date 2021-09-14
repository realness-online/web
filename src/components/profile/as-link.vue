<template lang="html">
  <router-link v-if="person" :to="author" class="profile">
    <as-avatar :person="person" />
    <as-hgroup :person="person">
      <slot />
    </as-hgroup>
  </router-link>
</template>
<script>
  import { load, as_author } from '@/helpers/itemid'
  import as_svg from '@/components/avatars/as-svg'
  import as_hgroup from '@/components/profile/as-hgroup'
  export default {
    components: {
      'as-avatar': as_svg,
      'as-hgroup': as_hgroup
    },
    props: {
      itemid: {
        type: String,
        required: true
      }
    },
    data () {
      return {
        person: null
      }
    },
    computed: {
      author () {
        return as_author(this.itemid)
      }
    },
    async created () {
      this.person = await load(this.author)
    }
  }
</script>
<style lang="stylus">
  a.profile
    display: inline-flex
    shape-outside: circle()
    margin-right: round((base-line / 3), 2)
    & > svg
      shape-outside: circle()
      fill: dark-black
      width: base-line * 2
      height: base-line * 2
      border-radius: round((base-line * 2), 2)
      margin-right: round((base-line / 6), 2)
    & > svg > svg.background
      fill: blue
    & > hgroup
      & > time
        color: red
      & > h3
        line-height: 1
        display: inline-block
</style>
