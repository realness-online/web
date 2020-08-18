<template lang="html">
  <button class="sign-on" @click="sign_on"><slot>Sign on</slot></button>
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
