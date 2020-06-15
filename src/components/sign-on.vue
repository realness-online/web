<template lang="html">
  <button class="sign-on" autofocus @click="sign_on">Sign on</button>
</template>
<script>
  export default {
    methods: {
      sign_on (event) {
        this.$router.push({ path: '/sign-on' })
      }
    }
  }
</script>
<style lang="stylus">
</style>
