<template lang="html">
  <section id="profile">
    <header>
      <h1>Profile</h1>
    </header>
  </section>
</template>
<script>
  export default {
    data() {
      return {}
    }
  }
</script>
<style lang='stylus'>
  @require 'style/variables'
  section#profile
    padding: 0 base-line
    & > details
      margin: base-line 0
</style>
