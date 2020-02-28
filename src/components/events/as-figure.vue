<template lang="html">
  <figure>
    <svg v-if="poster" :viewBox="poster.view_box" v-html="poster.path"></svg>
  </figure>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import intersection_mixin from '@/mixins/vector_intersection'
  import profile from '@/helpers/profile'
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
        poster: null
      }
    },
    methods: {
      async show() {
        console.log(this.event.url)
        const [person, poster] = this.event.url.split('/posters')
        console.log(person, poster)
        this.poster = profile.item(person, poster)
        const url = `/people${this.event.url}.html`
        const download_url = await this.storage.child(url).getDownloadURL()
        this.url = download_url
        console.log(download_url)
      }
    }
  }
</script>
<style lang="stylus">
</style>
