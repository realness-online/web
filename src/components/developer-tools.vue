<template lang="html">
  <table itemscope itemtype="/activity">
    <tbody>
      <tr v-for="[message, created_at] in activity">
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
      async info_logger() {
        this.info.apply(this, Array.prototype.slice.call(arguments))
        this.activity.push([arguments[0], new Date().toISOString()])
        await this.$nextTick()
        this.activity_storage.save()
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
    outline: 0.15vmin dashed orange
  [itemtype="/activity"]
    display:none
</style>
