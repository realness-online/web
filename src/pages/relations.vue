<template>
  <section id="relations" class="page">
    <header>
      <router-link to="/phonebook"><icon name="heart"></icon></router-link>
      <h1>Relations</h1>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-list :people='relations'></profile-as-list>
    <profile-as-links itemprop="relations" :people='relations'></profile-as-links>
  </section>
</template>
<script>
  import relationship_status from '@/mixins/relationship_status'
  import logoAsLink from '@/components/logo-as-link'
  import icon from '@/components/icon'
  import profileAsList from '@/components/profile/as-list'
  import profileAsLinks from '@/components/profile/as-links'
  export default {
    mixins: [relationship_status],
    components: {
      icon,
      profileAsList,
      profileAsLinks,
      logoAsLink
    }
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#relations svg.heart
    fill: blue
</style>
