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
    data() {
      return {
        previous: null,
        activity_storage: new Activity(),
        activity: [],
        info: console.info
      }
    },
    created() {
      Vue.config.errorHandler = this.on_error
      console.info = this.info_logger
    },
    methods: {
      eight_seconds_ago() {
        return Date.now() - (1000 * 8)
      },
      async info_logger() {
        this.info.apply(this, Array.prototype.slice.call(arguments))
        this.activity.push([arguments[0], new Date().toISOString()])
        const last_save = sessionStorage.getItem('activity-synced')
        if (!last_save || parseInt(this.eight_seconds_ago()) > parseInt(last_save)) {
          console.log('saving it')
          sessionStorage.setItem('activity-synced', Date.now())
          await this.$nextTick()
          this.activity_storage.save()
        } else console.log(this.eight_seconds_ago() - parseInt(last_save))
      },
      async on_error(event) {
        this.activity.push([event.message, new Date().toISOString()])
        await this.$nextTick()
        this.activity_storage.save()
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
