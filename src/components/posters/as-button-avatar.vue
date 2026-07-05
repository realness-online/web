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
  <button
    type="button"
    class="avatar"
    :aria-label="is_avatar ? 'Remove as avatar' : 'Set as avatar'"
    :aria-pressed="is_avatar"
    @click="toggle_avatar">
    <icon name="silhouette" :class="{ true: is_avatar }" />
  </button>
</template>

<style lang="stylus">
  menu > button.avatar
    appearance: none
    background: none
    border: 0
    padding: 0
    cursor: pointer
    color: inherit
  menu > button > svg.true
    fill: emphasis !important
</style>
