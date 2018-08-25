<template>
  <section id="home" v-bind:class="slide_direction" class="page">
    <main-nav></main-nav>
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
    computed: {
      slide_direction() {
        return {
          left: ['/relations', '/profile'].includes(sessionStorage.previous)
        }
      }
    }
  }
</script>
<style lang="stylus">
  section#home.page
    padding: 0
</style>
