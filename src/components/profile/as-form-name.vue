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
        id="name"
        v-model="me.name"
        type="text"
        autocomplete="name"
        placeholder="Name" />
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
    input#name
      width: 100%
    menu
      display: flex
      justify-content: end
</style>
