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
  import 'firebase/auth'
  import {person_storage} from '@/modules/Storage'

  export default {
    data() {
      return {
        storage: person_storage
      }
    },
    components: {
      'developer-tools': developer_tools
    },
    created() {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          this.storage.sync()
        }
      })
    }
  }
</script>
