<template lang="html">
  <figure>
    <svg></svg>
  </figure>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import intersection_mixin from '@/mixins/intersection'
  export default {
    mixins: [intersection_mixin],
    props: {
      event: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        storage: firebase.storage().ref(),
        poster: null,
        url: null
      }
    },
    async created() {
      console.log('what', this.event)
      const url = `/people${this.event.url}.html`
      console.log(url)
      const download_url = await this.storage.child(url).getDownloadURL()
      console.log(download_url)
      this.url = download_url
      // download and get path info from the poster
    },
    methods: {
      async show() { console.log('show!!!!!') }
    }
  }
</script>
<style lang="stylus">
</style>
