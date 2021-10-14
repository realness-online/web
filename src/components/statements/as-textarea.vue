<template>
  <textarea id="wat" v-model="new_statement"
            cols="1" rows="1"
            placeholder=">"
            :spellcheck="true"
            @focusout="prepare_statement"
            @focusin="focused" />
</template>
<script>
  const links = ['http://', 'https://']
  export default {
    emits: ['toggle-keyboard', 'update:statement'],
    data () {
      return {
        new_statement: ''
      }
    },
    methods: {
      focused () {
        console.info('display:statement-form')
        this.$emit('toggle-keyboard')
      },
      prepare_statement () {
        this.$emit('toggle-keyboard')
        const statement = {}
        statement.statement = this.new_statement && this.new_statement.trim()
        if (!statement.statement) return
        this.new_statement = ''
        const has_link = links.some(link => {
          return statement.statement.includes(link)
        })
        if (has_link) return
        statement.id = `${localStorage.me}/statements/${new Date().getTime()}`
        this.$emit('update:statement', statement)
        console.info('creates:statement')
      }
    }
  }
</script>
<style lang="stylus">
  textarea#wat
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
    &:focus
    &:active
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
      &::placeholder
        color: red
        text-align: left
</style>
