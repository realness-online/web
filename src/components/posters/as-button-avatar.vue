<script setup>
  import Icon from '@/components/icon'
  import { is_vector_id } from '@/use/poster'
  import { computed } from 'vue'
  import { me } from '@/utils/serverless'
  import { use_me } from '@/use/people'
  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    }
  })
  const { save } = use_me()
  const is_avatar = computed(() => {
    if (props.itemid === me.value.avatar) return true
    return false
  })
  const toggle_avatar = async () => {
    if (me.value) {
      if (me.value.avatar === props.itemid) me.value.avatar = undefined
      else me.value.avatar = props.itemid
      await save()
    }
  }
</script>

<template>
  <a class="avatar" @click="toggle_avatar">
    <icon name="silhouette" :class="{ true: is_avatar }" />
  </a>
</template>

<style lang="stylus">
  menu > a > svg.true
    fill: red !important
</style>
