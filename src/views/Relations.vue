<template>
  <section id="relations" class="page">
    <header>
      <router-link to="/phone-book"><icon name="heart"></icon></router-link>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Relations</h1>
    </hgroup>
    <profile-as-list :people='relations'></profile-as-list>
  </section>
</template>
<script>
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_list from '@/components/profile/as-list'
  import { relations_storage } from '@/persistance/Storage'
  import signed_in from '@/mixins/signed_in'
  import profile from '@/helpers/profile'
  export default {
    mixins: [signed_in],
    components: {
      icon,
      'profile-as-list': profile_as_list,
      'logo-as-link': logo_as_link
    },
    data() {
      return {
        relations: relations_storage.as_list()
      }
    },
    created() {
      this.relations.forEach(async(relation, index) => {
        const person = await profile.load(relation.id)
        this.relations.splice(index, 1, person)
      })
    }
  }
</script>
<style lang='stylus'>
  section#relations
    & > header
      margin: auto
      @media (min-width: mid-screen)
        max-width: page-width
    svg
      &.heart
        fill: blue
      &.working
        margin-bottom: base-line
</style>
