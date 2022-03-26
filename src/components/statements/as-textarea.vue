<template>
  <textarea
    id="wat"
    v-model="new_statement"
    cols="1"
    rows="1"
    placeholder=">"
    :spellcheck="true"
    @focusout="prepare_statement"
    @focusin="focused" />
</template>
<script setup>
  import { ref } from 'vue'
  const links = ['http://', 'https://']
  const emit = defineEmits(['toggle-keyboard', 'update:statement'])
  const new_statement = ref('')
  const focused = () => emit('toggle-keyboard')
  const prepare_statement = () => {
    emit('toggle-keyboard')
    const post = {}
    post.statement = new_statement.value.trim()
    if (!post.statement || links.some(link => post.statement.includes(link)))
      return
    post.id = `${localStorage.me}/statements/${new Date().getTime()}`
    emit('update:statement', post)
    new_statement.value = ''
    console.info('creates:statement')
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
