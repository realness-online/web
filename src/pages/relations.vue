<template>
  <section id="relations" class="page">
    <header>
      <router-link to="/phonebook"><icon name="heart"></icon></router-link>
      <h1>Relations</h1>
      <logo-as-link></logo-as-link>
    </header>
    <profile-as-list itemprop="relations" :people='relations'></profile-as-list>
  </section>
</template>
<script>
  import relationship_mixin from '@/pages/relationship-mixin'
  export default {
    mixins: [relationship_mixin]
  }
</script>
<style lang='stylus'>
  @require '../style/variables'
  section#relations svg.heart
    fill:blue
    height: (base-line * 2)
    width: (base-line * 2)
</style>
