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
  import profile_init from '@/mixins/profile_init'
  export default {
    mixins: [profile_init],
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
    height: 80vh
    display: flex
    flex-direction: column
    justify-content: flex-start
    align-content: stretch
    figure.profile
      margin-top: base-line * 1.5
      padding: 0
      flex-grow: 1
      display: flex
      flex-direction: column
      justify-content: flex-start
      align-content: stretch
      & > svg
        animation-name: slideInDown
        border-radius: 100vw
        width: 100vw
        height:100vw
        max-height: 90vh
      & > figcaption
        display:none
</style>
