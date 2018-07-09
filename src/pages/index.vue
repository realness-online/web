<template>
  <section id="home">
    <main-nav></main-nav>
    <aside>
      <post-index></post-index>
      <activity-index></activity-index>
    </aside>
  </section>
</template>

<script>
  import main_nav from '@/components/main-nav'
  import post_index from '@/components/posts/as-list'
  import activity_index from '@/components/activity/as-list'
  export default {
    components: {
      'main-nav': main_nav,
      'activity-index': activity_index,
      'post-index': post_index
    }
  }
</script>

<style lang="stylus">
  section#home
    animation-name: slideInRight
</style>
