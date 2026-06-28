<script setup>
  import { me } from '@/utils/serverless'
  import { use_me } from '@/use/people'
  import { ref, watchEffect as watch_effect } from 'vue'

  const emit = defineEmits(['valid'])
  const { is_valid_name, save } = use_me()
  const saving = ref(false)
  const saved = ref(false)
  const initial_name = ref(null)
  const has_focused = ref(false)

  watch_effect(() => {
    if (is_valid_name.value) emit('valid')
  })

  const handle_focus = () => {
    if (!has_focused.value) {
      has_focused.value = true
      if (me.value) initial_name.value = me.value.name
    }
  }

  const SAVED_DISPLAY_TIME = 2000

  const handle_blur = async () => {
    if (!has_focused.value) return
    const current_name = me.value?.name
    if (current_name === initial_name.value) return

    const valid = is_valid_name.value
    if (!valid) return

    saving.value = true
    saved.value = false

    await save()
    // eslint-disable-next-line require-atomic-updates
    initial_name.value = me.value?.name

    saving.value = false
    saved.value = true

    setTimeout(() => {
      saved.value = false
    }, SAVED_DISPLAY_TIME)
  }
</script>

<template>
  <form id="profile-name" v-if="me" @submit.prevent="handle_blur">
    <fieldset id="name" :class="{ saved: saved, saving: saving }">
      <input
        id="name"
        v-model="me.name"
        type="text"
        autocomplete="name"
        placeholder="Name"
        @focus="handle_focus"
        @blur="handle_blur"
        @keydown.enter.prevent="handle_blur" />
    </fieldset>
  </form>
</template>

<style lang="stylus">
  form#profile-name
    &.complete
      animation-name: slide-out-right
    fieldset.saving input#name
      border-color: orange
    fieldset.saved input#name
      border-color: blue
    input#name
      width: 100%
    menu
      display: flex
      justify-content: end
</style>
