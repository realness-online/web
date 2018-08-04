<template>
  <section id="feed" class="page left">
    <header>
      <icon name="hamburger"></icon>
      <h1>Feed</h1>
      <logo-as-link></logo-as-link>
    </header>
  </section>
</template>
<script>
  import logo_as_link from '@/components/logo-as-link'
  import icon from '@/components/icon'
  export default {
    components: {
      'logo-as-link': logo_as_link,
      icon
    }
  }
</script>
<style lang="stylus">
  section#feed > header > svg
    fill: transparent
</style>
