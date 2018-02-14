<template lang="html">
  <section id="feed">
    <header>
      <h2>Feed</h2>
    </header>
    <posts-list></posts-list>
  </section>
</template>

<style lang="stylus">
  @require '/style/variables'
  section#feed
    margin: 0 base-line
    display:flex
    flex-direction: column
</style>

<script>
  import posts_list from '@/components/posts-list'
  import activity_list from '@/components/activity-list'
  import '@/modules/timeago'
  export default {
    components: {
      'activity-list': activity_list,
      'posts-list': posts_list
    }
  }
</script>
