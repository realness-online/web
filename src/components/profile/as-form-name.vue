<script setup>
  import { ref } from 'vue'
  import { me } from '@/utils/serverless'
  import { use_me } from '@/use/people'
  const emit = defineEmits(['valid'])
  const { save, is_valid_name } = use_me()
  const save_me = async () => {
    if (is_valid_name.value) {
      await save()
      emit('valid')
    }
  }
</script>

<template>
  <form id="profile-name" v-if="me">
    <fieldset id="name">
      <legend :class="{ valid: is_valid_name }">Name</legend>
      <input
        id="first-name"
        v-model="me.first_name"
        type="text"
        placeholder="First" />
      <input
        id="last-name"
        v-model="me.last_name"
        type="text"
        placeholder="Last" />
    </fieldset>
  </form>
</template>

<style lang="stylus">
  form#profile-name
    // animation-name: slide-in-left
    &.complete
      animation-name: slide-out-right
    fieldset
      margin-bottom: base-line
    input#first-name
      width: 40%
      margin-right: base-line
    input#last-name
      width: 40%
    menu
      display: flex
      justify-content: end
</style>
