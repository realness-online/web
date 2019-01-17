<style src="@/style/index.styl" lang="stylus"></style>
<template lang="html">
  <main id="realness">
    <h6>Version {{version}}</h6>
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
    data() {
      return {
        version: process.env.VUE_APP_VERSION
      }
    },
    created() {
      console.log('initialize app')
      let config = {
        apiKey: process.env.VUE_APP_API_KEY,
        authDomain: process.env.VUE_APP_AUTH_DOMAIN,
        databaseUrl: process.env.VUE_APP_DATABASE_URL,
        projectId: process.env.VUE_APP_PROJECT_ID,
        storageBucket: process.env.VUE_APP_STORAGE_BUCKET,
        messagingSenderId: process.env.VUE_APP_MESSAGING_SENDER_ID
      }
      firebase.initializeApp(config)
    },
    components: {
      'developer-tools': developer_tools
    }
  }
</script>
<style lang="stylus">
  @require '/style/variables'
  #realness > h6
    position:fixed
    bottom: base-line
    left: base-line
</style>
