<script setup>
  import { me } from '@/utils/serverless'
  import { use_me, name_error } from '@/use/people'
  import { ref, watchEffect as watch_effect } from 'vue'

  const emit = defineEmits(['valid'])
  const { is_valid_name, save } = use_me()
  const saving = ref(false)
  const saved = ref(false)
  const initial_name = ref(null)
  const has_focused = ref(false)
  const show_error = ref(false)
  const display_error = ref(null)

  watch_effect(() => {
    if (is_valid_name.value) emit('valid')
  })

  const handle_focus = () => {
    show_error.value = false
    display_error.value = null
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

    if (!is_valid_name.value) {
      display_error.value = name_error(current_name)
      show_error.value = true
      if (me.value && initial_name.value !== null)
        me.value.name = initial_name.value
      return
    }

    if (me.value?.name) me.value.name = me.value.name.trim()

    saving.value = true
    saved.value = false

    await save()
    // eslint-disable-next-line require-atomic-updates
    initial_name.value = me.value?.name

    saving.value = false
    saved.value = true
    show_error.value = false
    display_error.value = null

    setTimeout(() => {
      saved.value = false
    }, SAVED_DISPLAY_TIME)
  }
</script>

<template>
  <form id="profile-name" v-if="me" @submit.prevent="handle_blur">
    <fieldset
      id="name"
      :class="{ saved: saved, saving: saving, invalid: show_error }">
      <legend :class="{ valid: is_valid_name }">
        {{ me.name?.trim() || 'Name' }}
      </legend>
      <input
        id="name"
        v-model="me.name"
        type="text"
        autocomplete="name"
        placeholder="Name"
        required
        minlength="3"
        :aria-invalid="show_error ? 'true' : undefined"
        :aria-describedby="show_error ? 'name-error' : undefined"
        @focus="handle_focus"
        @blur="handle_blur"
        @keydown.enter.prevent="handle_blur" />
      <p v-if="show_error" id="name-error" role="alert">
        {{ display_error }}
      </p>
    </fieldset>
  </form>
</template>

<style lang="stylus">
  form#profile-name {
    &.complete {
      animation-name: slide-out-right;
    }
    fieldset.saving input#name {
      border-color: var(--caution);
    }
    fieldset.saved input#name {
      border-color: var(--accent);
    }
    fieldset.invalid input#name {
      border-color: var(--danger);
    }
    input#name {
      width: 100%;
    }
    p#name-error {
      margin: (base-line * 0.25) 0 0;
      font-size: 0.75em;
      color: var(--emphasis);
    }
    menu {
      display: flex;
      justify-content: end;
    }
  }
</style>
