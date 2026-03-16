<script setup>
  import Icon from '@/components/icon'
  import { ref } from 'vue'
  import { use } from '@/use/statements'
  import { use_keymap } from '@/use/key-commands'
  const emit = defineEmits(['toggle-keyboard', 'tab-next'])
  defineOptions({ inheritAttrs: false })
  const { save } = use()
  const thought_text = ref(null)

  const prepare_thought = async () => {
    emit('toggle-keyboard', false)
    const textarea = document.querySelector('textarea#wat')
    if (textarea) textarea.style.height = ''
    const text = thought_text.value
    thought_text.value = null
    if (typeof text !== 'string') return

    const trimmed = text.trim()
    if (!trimmed) return

    await save(trimmed)

    if (thought_text.value === text) thought_text.value = null
  }

  const adjust_height = event => {
    const textarea = event.target
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  const { register } = use_keymap('Thoughts')
  register('thought::Save', () => prepare_thought())
  register('thought::New_Line', () => {
    const textarea = document.querySelector('textarea#wat')
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const { value } = textarea
      textarea.value = `${value.substring(0, start)}\n${value.substring(end)}`
      textarea.selectionStart = textarea.selectionEnd = start + 1
      adjust_height({ target: textarea })
    }
  })
  register('thought::Cancel', () => {
    thought_text.value = null
    emit('toggle-keyboard', false)
  })
</script>

<template>
  <div class="posting-input">
    <textarea
      id="wat"
      v-bind="$attrs"
      v-model="thought_text"
      cols="1"
      rows="1"
      class="black"
      placeholder=""
      :spellcheck="true"
      @input="adjust_height"
      @focusout="prepare_thought"
      @keydown.tab.exact="e => emit('tab-next', e)" />
    <button id="done">
      <icon name="finished" />
    </button>
  </div>
</template>

<style lang="stylus">
  section#thoughts .posting-input {
    display: flex;
    flex-direction: column;
    gap: base-line;
    padding: base-line;
    & textarea#wat {
      line-height: 1.5;
      padding: base-line;
      border-radius: base-line;
      resize: none;
      appearance: none;
      border: 1px solid var(--red);
      background-color: var(--black-transparent);
      color: var(--rocks);
      caret-color: var(--rocks);
      outline: 0;
       min-height: base-line;
      @media (prefers-color-scheme: light) {
        background-color: transparent;
        border: none;
        border: 1px solid var(--red);
      }
      @media (prefers-color-scheme: dark) {
        color: white-text;
      }
      &::placeholder {
        color: var(--rocks);
        opacity: 0.8;
      }
    }
    & button#done {
      display: none;
      border: none;
      background: none;
      padding: base-line * 0.5;
      cursor: pointer;
      align-self: flex-end;
      svg {
        fill: var(--boulders);
      }
    }
  }
  main#realness.posting section#thoughts .posting-input {
    & textarea#wat {
      font-size: 1.25em;
      min-height: base-line * 6;
    }
    & button#done {
      display: block;
    }
  }
</style>
