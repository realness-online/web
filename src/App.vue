<style src="@/style/index.styl" lang="stylus"></style>
<template lang="html">
  <main id="realness">
    <router-view></router-view>
    <developer-tools></developer-tools>
  </main>
</template>
<script>
  import developer_tools from '@/components/developer'
  import * as firebase from 'firebase/app'
  export default {
    watch: {
      '$route' (to, from) {
        sessionStorage.previous = from.path
      }
    },
    created() {
      console.log('initialize app');
      firebase.initializeApp(process.env.FIREBASE_CONFIG)
    },
    components: {
      'developer-tools': developer_tools
    }
  }
</script>
