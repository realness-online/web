<template>
  <section id="events" class="page">
    <header>
      <icon name=""></icon>
      <h1>Events</h1>
      <logo-as-link></logo-as-link>
    </header>
    <h2>It's gonna be a minute</h2>
  </section>
</template>
<script>
  import logoAsLink from '@/components/logo-as-link'
  import icon from '@/components/icon'
  export default {
    components: {
      logoAsLink,
      icon
    },
    data() {
      return {}
    }
  }
</script>
<style lang="stylus">
  @require '../style/variables'
  section#events
    & > header
      margin-bottom: base-line
      & > svg
        fill: transparent
</style>
