<template>
  <section id="avatar" class="page">
    <header>
      <icon name=""></icon>
      <a @click='finished_viewing'>
        <icon name="finished"></icon>
      </a>
    </header>
    <icon v-if="working" name="working"></icon>
    <profile-as-figure v-else :person='person' :just_display_avatar="true"></profile-as-figure>
  </section>
</template>
<script>
  import icon from '@/components/icon'
  import profileAsFigure from '@/components/profile/as-figure'
  import { person_storage } from '@/modules/Storage'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import profile_id from '@/modules/profile_id'
  export default {
    data() {
      return {
        person: {},
        working: true,
        me: false
      }
    },
    created() {
      const id = `/${this.$route.params.phone_number}`
      profile_id.load(id).then(profile => {
        this.person = profile
      })
      profile_id.items(id, 'posts').then(items => {
        this.posts = items
        this.working = false
      })
    },
    components: {
      icon, profileAsFigure
    },
    methods: {
      finished_viewing() {
        const route = {
          path: sessionStorage.previous
        }
        this.$router.push(route)
      }
    }
  }
</script>
<style lang="stylus">
  section#avatar
    animation-name: slideInLeft
    min-height: 80vh
    display: flex
    flex-direction: column
    justify-content: flex-start
    align-content: stretch
    figure.profile
      margin-top: base-line * 1.5
      padding: 0
      flex-grow: 1
      display: flex
      justify-content: flex-start
      align-content: stretch
      & > svg
        -webkit-tap-highlight-color: transparent
        animation-name: slideInDown
        width: 100vw
        height:100vw
        max-height: 90vh
      & > figcaption
        display:none
</style>
