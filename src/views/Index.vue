<template>
  <section id="home" class="page">
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
    }
  }
</script>
<style lang="stylus">
  section#home.page
    padding: base-line
    height:100vh
    display: flex
    align-items: center
    margin:auto
    max-width: page-width
    & > h6.app_version
      margin: 0
      position: fixed
      bottom: (base-line / 2)
      left: (base-line / 2)

</style>
