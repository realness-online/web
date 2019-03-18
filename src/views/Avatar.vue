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
  import profile from '@/modules/Profile'
  export default {
    data() {
      return {
        person: {},
        working: true,
        me: false
      }
    },
    created() {
      const profile_id = `/${this.$route.params.phone_number}`
      profile.load(profile_id).then(profile => {
        this.person = profile
      })
      profile.items(profile_id, 'posts').then(items => {
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
  @require '../style/variables'
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
