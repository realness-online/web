<template lang="html">
  <section id="admin" class="page">
    <header>
      <icon name="nothing"></icon>
      <h1>Admin</h1>
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
    },
    created () {
      console.log('I am running')
    }
  }
</script>
<style lang="stylus">

</style>
