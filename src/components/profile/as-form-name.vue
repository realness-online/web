<script setup>
  import Icon from '@/components/icon'
  import { me } from '@/utils/serverless'
  import { use_me, name_error } from '@/use/people'
  import { ref, watchEffect as watch_effect } from 'vue'

  const emit = defineEmits(['valid'])
  const { is_valid_name, save } = use_me()
  const saving = ref(false)
  const initial_name = ref(null)
  const has_focused = ref(false)
  const show_error = ref(false)
  const display_error = ref(null)

  watch_effect(() => {
    if (is_valid_name.value) emit('valid')
  })

  const on_focus = () => {
    show_error.value = false
    display_error.value = null
    if (!has_focused.value) {
      has_focused.value = true
      if (me.value) initial_name.value = me.value.name
    }
  }

  const on_blur = async () => {
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

    await save()
    // eslint-disable-next-line require-atomic-updates
    initial_name.value = me.value?.name

    saving.value = false
    show_error.value = false
    display_error.value = null
  }
</script>

<template>
  <form id="profile-name" v-if="me" @submit.prevent="on_blur">
    <fieldset data-preference :aria-busy="saving || undefined">
      <div>
        <h4 :data-valid="is_valid_name || undefined">Name</h4>
        <icon v-if="saving" name="working" />
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
          @focus="on_focus"
          @blur="on_blur"
          @keydown.enter.prevent="on_blur" />
      </div>
      <p v-if="show_error" id="name-error" role="alert">
        {{ display_error }}
      </p>
    </fieldset>
  </form>
</template>

<style>
  form#profile-name {
    max-width: none;

    fieldset > div {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: calc(var(--base-line) * 0.5);

      h4 {
        margin: 0;
        font-weight: 300;
        color: var(--muted-text);
        &[data-valid] {
          color: var(--accent);
        }
      }

      svg.icon {
        margin-inline-start: auto;
        color: var(--working);
        animation: working-pulse 1.5s ease-in-out infinite;
      }
    }
    input#name[aria-invalid='true'] {
      border-color: var(--emphasis);
    }
    input#name {
      max-width: calc(var(--base-line) * 12);
      text-align: end;
    }
    p#name-error {
      margin: 0;
      font-size: 0.75em;
      color: var(--emphasis);
    }
  }
</style>
