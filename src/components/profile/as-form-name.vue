<template>
  <form id="profile-name">
    <fieldset id="name">
      <legend :class="{ valid: is_valid_name }">Name</legend>
      <input
        id="first-name"
        v-model="me.first_name"
        type="text"
        placeholder="First"
        @keyup="modified_check" />
      <input
        id="last-name"
        v-model="me.last_name"
        type="text"
        placeholder="Last"
        @keyup="modified_check" />
    </fieldset>
    <menu>
      <button ref="button" disabled @click.prevent="save_me">
        Yep, That's my name
      </button>
    </menu>
  </form>
</template>
<script setup>
  import { computed, ref } from 'vue'
  import { use_me } from '@/use/people'
  const emit = defineEmits(['valid'])
  const { me, save, is_valid_name } = use_me()
  const button = ref()
  const save_me = async () => {
    me.value.visited = new Date().toISOString()
    if (is_valid_name.value) {
      await save()
      emit('valid')
    }
  }
  const modified_check = async () => {
    if (is_valid_name.value) button.value.disabled = false
    else button.value.disabled = true
  }
</script>
<style lang="stylus">
  form#profile-name
    animation-name: slide-in-left
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
      justify-content: flex-end
</style>
