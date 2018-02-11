<template lang="html">
  <section id="feed">

    <details>
      <summary><h3>Feed</h3></summary>
      <p>
        So sad.
        <a href="/groups"> So very very sad</a>
      </p>
    </details>
    <details>
      <summary><h3>Activity</h3> </summary>
      <activity-list :activity="activity"></activity-list>
    </details>
    <details>
      <summary><h3>Posts</h3></summary>
      <posts-list :posts="posts"></posts-list>
    </details>
  </section>
</template>

<style lang='stylus'>
  @require 'application'
  section#feed
    display:flex
    flex-direction: column
    padding: 0 base-line
    & > details[open]
      min-height:100vh
</style>

<script>
  import {posts_storage, activity_storage} from '@/modules/Storage'
  import posts_list from '@/components/posts-list'
  import activity_list from '@/components/activity-list'
  import '@/modules/timeago'
  export default {
    components: {
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
