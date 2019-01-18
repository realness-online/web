<template>
  <section id="home" v-bind:class="slide_direction" class="page">
    <main-nav></main-nav>
    <h6 class="app_version">{{version}}</h6>
    <aside>
      <my-posts></my-posts>
    </aside>
  </section>
</template>
<script>
  import mainNav from '@/components/main-nav'
  import myPosts from '@/components/posts/my-list'
  export default {
    components: {
      mainNav,
      myPosts
    },
    data() {
      return {
        version: process.env.VUE_APP_VERSION
      }
    },
    computed: {
      slide_direction() {
        return {
          left: ['/relations', '/profile', '/events'].includes(sessionStorage.previous)
        }
      }
    }
  }
</script>
<style lang="stylus">
  @require '../style/variables'
  h6.app_version
    margin: 0
    position:fixed
    bottom: (base-line / 2)
    left: (base-line / 2)
  section#home.page
    padding: 0
</style>
