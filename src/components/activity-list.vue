<template>
  <ol itemprop="activity">
    <li v-for="event in activity" itemscope itemtype="/activity">
      <a itemprop="where" :href="event.where">
        <b itemprop="what">{{event.what}}</b>
      </a>
      <time itemprop="when" :datetime="event.when"></time>
    </li>
  </ol>
</template>
<script>
  import Vue from 'vue'
  import {activity_storage} from '@/modules/Storage'
  export default {
    data() {
      return {
        activity: activity_storage.as_list()
      }
    },
    created: function() {
      // TODO: add event for profile created.
      // TODO: add event for profile updated.
      this.$bus.$on('post-added', post => {
        this.activity.push({
          who: 'person/id',
          what: 'created a post',
          why: 'unknown',
          when: post.created_at,
          where: post.location
        })
      })
    },
    watch: {
      activity() {
        Vue.nextTick(() => {
          // console.log('inside activity_list.activity()')
          activity_storage.save()
        })
      }
    }
  }
</script>

<style lang="stylus">
  @require '../style/variables'
  ol[itemprop="activity"]
    display:flex
    flex-direction: column-reverse
    & > li
      list-style: none
      margin-bottom: base-line
</style>
