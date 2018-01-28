<template lang="html">
  <main>
    <activity :activity="activity"></activity>
    <posts :posts="posts"></posts>
  </main>
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

<style lang="stylus" scoped>
  @require 'style/variables'
</style>
