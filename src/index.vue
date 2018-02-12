<template>
  <section id="app">
    <main-nav></main-nav>
    <activity-list></activity-list>
    <posts-list></posts-list>
  </section>
</template>

<script>
  import main_nav from '@/components/nav'
  import posts_list from '@/components/posts-list'
  import activity_list from '@/components/activity-list'
  export default {
    components: {
      'main-nav': main_nav,
      'activity-list': activity_list,
      'posts-list': posts_list
    }
  }
</script>

<style lang="stylus">
  @require 'application'
  section#app
    padding:0 base-line
</style>
