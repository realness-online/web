<template>
  <section id="relations" class="page">
    <header>
      <router-link to="/phone-book">
        <icon name="heart"/>
      </router-link>
      <logo-as-link/>
    </header>
    <hgroup>
      <h1>Relations</h1>
    </hgroup>
    <profile-as-list :people="relations"/>
  </section>
</template>
<script>
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import profile_as_list from '@/components/profile/as-list'
  import signed_in from '@/mixins/signed_in'
  import itemid from '@/helpers/itemid'
  export default {
    components: {
      icon,
      'profile-as-list': profile_as_list,
      'logo-as-link': logo_as_link
    },
    mixins: [signed_in],
    data () {
      return {
        relations: []
      }
    },
    async created () {
      console.info('Views relations')
      this.relations = await itemid.list(`${this.me}/relations`)
      this.relations.forEach(async (relation, index) => {
        const person = await itemid.load(relation.id)
        this.relations.splice(index, 1, person)
      })
    }
  }
</script>
<style lang='stylus'>
  section#relations
    & > header
      margin: auto
      @media (min-width: typing-begins)
        max-width: page-width
    svg
      &.heart
        fill: blue
      &.working
        margin-bottom: base-line
</style>
