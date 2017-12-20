<template>
  <ol id="activity" itemprop="activity">
    <li v-for="event in activity" itemscope itemtype="/activity">
      <a itemprop="where"   :href="event.where"><b itemprop="what">{{event.what}}</b></a>
      <time itemprop="when" :datetime="event.when"></time>
    </li>
  </ol>
</template>

<script>
  import Vue from 'vue'
  import {activity_storage} from '../modules/Storage'
  export default {
    name: 'profile-activity',
    props: ['activity'],
    watch: {
      activity() {
        console.log('inside activity watch')
        Vue.nextTick(() => {
          activity_storage.save()
        })
      }
    }
  }
</script>
