<template lang="html">
  <table itemscope itemtype="/activity">
    <tbody>
      <tr v-for="[message, created_at] in activity" :key="created_at">
        <td><time>{{created_at}}</time></td>
        <td>{{message}}</td>
      </tr>
    </tbody>
  </table>
</template>
<script>
  import Vue from 'vue'
  import { Activity } from '@/persistance/Storage'
  export default {
    data () {
      return {
        previous: null,
        activity: [],
        info: console.info
      }
    },
    created () {
      if (process.env.NODE_ENV === 'production') {
        Vue.config.errorHandler = this.on_error
        console.info = this.info_logger
      }
    },
    methods: {
      one_second_ago () {
        return Date.now() - 1000
      },
      eight_seconds_ago () {
        return this.one_second_ago * 8
      },
      async info_logger () {
        this.info.apply(this, Array.prototype.slice.call(arguments))
        this.activity.push([arguments[0], new Date().toISOString()])
        const last_save = sessionStorage.getItem('activity-synced')
        if (!last_save || this.eight_seconds_ago() > parseInt(last_save)) {
          sessionStorage.setItem('activity-synced', Date.now())
          await this.$nextTick()
          new Activity().save()
        } else console.log(this.eight_seconds_ago() - parseInt(last_save))
      },
      async on_error (event) {
        const last_save = sessionStorage.getItem('activity-synced')
        if (!last_save || this.eight_seconds_ago() > parseInt(last_save)) {
          this.activity.push([event.message, new Date().toISOString()])
          await this.$nextTick()
          new Activity().save()
        }
      }
    }
  }
</script>
<style lang="stylus">
  [outline],
  [outline] *
    outline: 0.15vmin dashed black
  [itemtype="/activity"]
    display:none
</style>
