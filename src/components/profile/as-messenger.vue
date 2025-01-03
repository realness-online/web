<script>
  import { as_author } from '@/utils/itemid'
  import { as_phone_number } from '@/use/people'
  import icon from '@/components/icon'
  export default {
    components: {
      icon
    },
    props: {
      itemid: {
        type: String,
        required: true
      }
    },
    methods: {
      open_sms_app() {
        window.open(`sms:${as_phone_number(as_author(this.itemid))}`, '_self')
      }
    }
  }
</script>

<template>
  <a class="phone" @click="open_sms_app">
    <icon name="message" />
  </a>
</template>

<style lang="stylus">
  figure.profile > figcaption > menu a.phone > svg
    fill: blue
    opacity:0.25
    &:hover
    &:active
      opacity:1
</style>
