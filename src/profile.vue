<template lang="html">
  <section id="profile">
    <header>
      <h1>Profile</h1>
    </header>
    <activity :activity="activity"></activity>
  </section>
</template>
<script>
  import Item from '@/modules/Item'
  import {posts_storage, activity_storage} from '@/modules/Storage'
  import '@/modules/timeago'
  export default {
    data() {
      return {
        posts: Item.get_items(posts_storage.from_storage()),
        activity: Item.get_items(activity_storage.from_storage())
      }
    }
  }
</script>
<style lang="stylus">
  @require 'style/variables'
</style>
