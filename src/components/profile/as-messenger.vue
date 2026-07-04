<script setup>
  import { computed } from 'vue'
  import { as_author } from '@/utils/itemid'
  import { as_phone_number } from '@/use/people'
  import icon from '@/components/icon'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    }
  })

  defineOptions({
    name: 'ProfileMessenger'
  })

  const sms_href = computed(
    () => `sms:${as_phone_number(as_author(props.itemid))}`
  )
</script>

<template>
  <a class="phone" :href="sms_href" aria-label="Send a text message">
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
