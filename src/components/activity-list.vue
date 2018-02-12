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
        activity: activity_storage.get_items()
      }
    },
    created: function() {
      this.$bus.$on('post-added', post => {
        console.log('adding a post to the activity list')
        let event = {
          who: 'person/id',
          what: 'created a post',
          why: 'unknown',
          when: post.created_at,
          where: post.location
        }
        this.activity.push(event)
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
