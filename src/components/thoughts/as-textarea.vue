<script setup>
  import Icon from '@/components/icon'
  import { ref, nextTick as tick } from 'vue'
  import { use } from '@/use/thought'
  import { use_keymap } from '@/use/key-commands'

  const emit = defineEmits(['toggle-keyboard'])
  const { save } = use()
  const thought_text = ref(null)

  const SCROLL_DELAY_MS = 100

  const focused = async () => {
    emit('toggle-keyboard')
    const textarea = document.querySelector('textarea#wat')
    textarea.focus()
    await tick()
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      textarea.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      })
    }, SCROLL_DELAY_MS)
  }

  const prepare_thought = async () => {
    emit('toggle-keyboard')
    const textarea = document.querySelector('textarea#wat')
    textarea.style.height = ''
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
    emit('toggle-keyboard')
  })
</script>

<template>
  <textarea
    id="wat"
    v-bind="$attrs"
    v-model="thought_text"
    cols="1"
    rows="1"
    class="black"
    placeholder="✏️"
    :spellcheck="true"
    @input="adjust_height"
    @focusout="prepare_thought"
    @focusin="focused" />
  <button id="done">
    <icon name="finished" />
  </button>
</template>

<style lang="stylus">
  section#navigation.page {
    & textarea#wat {
      padding: base-line;
      border-radius: base-line;
      text-align: right;
      resize: none;
      appearance: none;
      transition-duration: 0.3s;
      user-select: text;
      border-style: solid;
      caret-color: red;
      cursor: pointer;
      transition-property: color, border-radius, text-align;
      min-height: base-line;
      @media (prefers-color-scheme: dark) {
        color: white-text;
      }
      &::placeholder {
        transition-property: all;
        font-family: inherit;
        color: white-text;
        @media (prefers-color-scheme: light) {
          color: black-background;
        }
      }
    }
    & button#done {
      color: white-text;
      border-color: black;
      border-radius: base-line;
      padding: base-line;
      position: fixed;
      bottom: base-line;
      right: base-line;
      z-index: 4;
      @media (min-width: pad-begins) {
        position: inherit;
      }
    }
    & button#done {
      display: none;
      border: none;
      position: absolute;
      top: inset(top, base-line);
      right: inset(right, base-line);
      width: fit-content;
      height: fit-content;
      padding: 0;
      svg {
        fill: white-text;
      }
    }
    &.posting button#done {
      display: block;
    }
    &.posting textarea#wat {
      position: fixed;
      top: inset(top, base-line * 3);
      right: inset(right, base-line);
      bottom: inset(bottom, base-line * 4);
      left: inset(left, base-line);
      font-size: 1.25em;
      font-weight: normal;
      padding: 0;
      text-align: left;
      border-top: none;
      border-radius: 0;
      border-width: 0;
      background-color: transparent;
      outline: 0;
      transition-duration: .3s;
      transition-property: border-radius, text-align;
      transition-timing-function: ease-out;
      line-height: base-line;
      min-height: base-line * 3;
      height: auto;
      text-align: inherit;
      margin-top: base-line;
      padding: 0;
      border-radius: 0;
      &::placeholder {
        color: white;
        text-align: left;
        @media (prefers-color-scheme: light) {
          color: red;
        }
      }
    }
  }
</style>
