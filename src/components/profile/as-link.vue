<template>
  <router-link v-if="person" :to="author" class="profile">
    <as-avatar :itemid="person.avatar" class="icon" />
    <as-address :person="person">
      <slot />
    </as-address>
  </router-link>
</template>
<script>
  import { load, as_author } from '@/use/itemid'
  import as_svg from '@/components/posters/as-svg'
  import as_address from '@/components/profile/as-address'
  export default {
    components: {
      'as-avatar': as_svg,
      'as-address': as_address
    },
    props: {
      itemid: {
        type: String,
        required: true
      }
    },
    data() {
      return {
        person: null
      }
    },
    computed: {
      author() {
        return as_author(this.itemid)
      }
    },
    async created() {
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
      fill: black-dark
      width: base-line * 2
      height: base-line * 2
      min-height: inherit
      border-radius: round((base-line * 2), 2)
      margin-right: round((base-line / 6), 2)
    & > address
      & > time
        color: red
      & > h3
        line-height: 1
        display: inline-block
</style>
