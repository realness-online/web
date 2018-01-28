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
  </section>
</template>
<script>
  import Item from '@/modules/Item'
  import {activity_storage} from '@/modules/Storage'
  import activity_list from '@/components/activity-list'
  import '@/modules/timeago'
  export default {
    components: {
      'activity-list': activity_list
    },
    data() {
      return {
        activity: Item.get_items(activity_storage.from_storage())
      }
    }
  }
</script>
<style lang="stylus"></style>
