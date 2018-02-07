<template>
  <section>
    <main-nav></main-nav>
    <activity-list :activity="activity"></activity-list>
    <posts-list :posts="posts"></posts-list>
  </section>
</template>

<script>
  import main_nav from '@/components/nav'
  import {posts_storage, activity_storage} from '@/modules/Storage'
  import posts_list from '@/components/posts-list'
  import activity_list from '@/components/activity-list'
  
  export default {
    components: {
      'main-nav': main_nav,
      'activity-list': activity_list,
      'posts-list': posts_list
    },
    data() {
      return {
        activity: activity_storage.get_items(),
        posts: posts_storage.get_items()
      }
    }
  }
</script>

<style lang="stylus">
  @require "./application"
</style>
