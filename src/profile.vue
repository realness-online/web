<template lang="html">
  <section id="profile">
    <header>
      <h1>Profile</h1>
    </header>
    <details>
      <summary>
        <h2>Activity list</h2>
      </summary>
      <activity-list :activity="activity"></activity-list>
    </details>
    <details>
      <summary>Posts</summary>
      <posts-list :posts="posts"></posts-list>
    </details>
  </section>
</template>

<script>
  import Item from '@/modules/Item'
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
        activity: Item.get_items(activity_storage.from_storage()),
        posts: Item.get_items(posts_storage.from_storage())
      }
    }
  }
</script>

<style lang="stylus"></style>
