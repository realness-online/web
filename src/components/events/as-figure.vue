<template lang="html">
  <figure>
    <icon name="background"></icon>
    <svg v-if="poster" :viewBox="poster.view_box" v-html="poster.path"></svg>
  </figure>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import intersection_mixin from '@/mixins/vector_intersection'
  import profile from '@/helpers/profile'
  import icon from '@/components/icon'
  export default {
    mixins: [intersection_mixin],
    components: { icon },
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
        const [person, poster] = this.event.url.split('/posters')
        console.log(person, poster)
        this.poster = await profile.item(person, `posters${poster}`)
        console.log(this.poster)
        // const url = `/people${this.event.url}.html`
        // const download_url = await this.storage.child(url).getDownloadURL()
      }
    }
  }
</script>
<style lang="stylus">
</style>
