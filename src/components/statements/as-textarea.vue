<template>
  <textarea
    id="wat"
    v-model="statement_text"
    cols="1"
    rows="1"
    placeholder=">"
    :spellcheck="true"
    @focusout="prepare_statement"
    @focusin="focused" />
</template>
<script setup>
  import { ref } from 'vue'
  import { use } from '@/use/statements'
  const { save } = use()
  const statement_text = ref(null)

  const emit = defineEmits(['toggle-keyboard'])
  const focused = () => emit('toggle-keyboard')
  const prepare_statement = () => {
    emit('toggle-keyboard')
    save(statement_text.value)
    statement_text.value = null
    console.info('creates:statement', post)
  }
</script>
<style lang="stylus">
  section#navigation.page
    & textarea#wat
        padding: base-line
        border-radius: base-line
        text-align: right
        resize: none
        appearance: none
        transition-duration: 0.3s
        user-select: text
        border-style: solid
        caret-color: red
        cursor: pointer
        transition-property: color, border-radius, text-align
        color: red
        @media (prefers-color-scheme: dark)
          color: white
        &::placeholder
          transition-property: all
          font-family: inherit
          color: white
          @media (prefers-color-scheme: light)
            color: #fff
    &.posting textarea#wat
      font-size: 1.25em
      font-weight: normal
      padding: 0
      grid-column: 1 / span 2
      grid-row: 1 / span 3
      text-align: left
      border-top: none
      border-radius: 0
      border-width: 0
      background-color: transparent
      outline: 0
      transition-duration: .3s
      transition-property: border-radius, text-align
      transition-timing-function: ease-out
      line-height: base-line
      height: auto
      text-align: inherit
      margin-top: base-line
      padding: 0
      border-radius: 0
      &::placeholder
        color: red
        text-align: left
        @media (prefers-color-scheme: light)
          color: red
</style>
