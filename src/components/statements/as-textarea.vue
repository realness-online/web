<script setup>
  import Icon from '@/components/icon'
  import { ref, nextTick as tick, inject } from 'vue'

  import { use } from '@/use/statement'

  const emit = defineEmits(['toggle-keyboard'])
  const { save } = use()
  const show_regular = inject('show_utility_components')

  /** @type {import('vue').Ref<string | null>} */
  const statement_text = ref(null)

  const focused = async () => {
    emit('toggle-keyboard')
    show_regular.value = false
    const textarea = document.querySelector('textarea#wat')
    textarea.focus()
    await tick()
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
      textarea.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      })
    }, 100)
  }

  const prepare_statement = async () => {
    console.info('prepare_statement')
    show_regular.value = true
    emit('toggle-keyboard')
    const textarea = document.querySelector('textarea#wat')
    textarea.style.height = ''
    const text = statement_text.value
    statement_text.value = null
    if (typeof text !== 'string') return

    const trimmed = text.trim()
    if (!trimmed) return

    await save(trimmed)

    if (statement_text.value === text) statement_text.value = null

    console.info('create:Statement')
  }

  const adjust_height = event => {
    const textarea = event.target
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }
</script>

<template>
  <textarea
    id="wat"
    v-bind="$attrs"
    v-model="statement_text"
    cols="1"
    rows="1"
    placeholder=">"
    :spellcheck="true"
    @input="adjust_height"
    @focusout="prepare_statement"
    @focusin="focused" />
  <button v-if="!show_regular" id="done">
    <icon name="finished" />
  </button>
</template>

<style lang="stylus">
  section#navigation.page
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
      color: red;
      background-color: red;
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
      border-color: red;
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
        fill: red;
      }
    }
    &.posting button#done {
      display: block;
    }
    &.posting textarea#wat {
      font-size: 1.25em;
      font-weight: normal;
      padding: 0;
      grid-column: 1 / span 2;
      grid-row: 1 / span 3;
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
        color: red;
        text-align: left;
        @media (prefers-color-scheme: light) {
          color: red;
        }
      }
    }
</style>
