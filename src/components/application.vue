<style src="@/style/index.styl" lang="stylus"></style>
<template lang="html">
  <main id="realness">
    <router-view></router-view>
    <developer-tools></developer-tools>
  </main>
</template>
<script>
  import developer_tools from '@/components/developer'
  export default {
    watch: {
      '$route' (to, from) {
        sessionStorage.previous = from.path
      }
    },
    components: {
      'developer-tools': developer_tools
    }
  }
</script>
