<style src="@/style/index.styl" lang="stylus"></style>
<template lang="html">
  <main id="realness">
    <transition name="fade" mode="out-in">
      <router-view></router-view>
    </transition>
    <developer-tools></developer-tools>
  </main>
</template>
<script>
  import developerTools from '@/components/developer-tools'
  import * as firebase from 'firebase/app'
  export default {
    watch: {
      '$route' (to, from) {
        sessionStorage.previous = from.path
      }
    },
    created() {
      console.log('initialize firebase')
      firebase.initializeApp({
        apiKey: process.env.VUE_APP_API_KEY,
        authDomain: process.env.VUE_APP_AUTH_DOMAIN,
        databaseUrl: process.env.VUE_APP_DATABASE_URL,
        projectId: process.env.VUE_APP_PROJECT_ID,
        storageBucket: process.env.VUE_APP_STORAGE_BUCKET,
        messagingSenderId: process.env.VUE_APP_MESSAGING_SENDER_ID
      })
    },
    components: {
      developerTools
    }
  }
</script>
