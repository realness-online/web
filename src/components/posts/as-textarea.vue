<template lang="html">
  <textarea id="wat"
    v-model="new_post"
    cols="1"
    rows="1"
    v-on:focusout="prepare_post"
    v-on:focusin="wat_focused"
    placeholder=">"></textarea>
</template>
<script>
  export default {
    props: ['value'],
    data() {
      return {
        new_post: ''
      }
    },
    methods: {
      prepare_post() {
        this.$emit('toggle-keyboard')
        let post = {}
        post.statement = this.new_post && this.new_post.trim()
        if (!post.statement) { return }
        this.new_post = ''
        post.created_at = new Date().toISOString()
        this.$bus.$emit('post-added', post)
      },
      wat_focused($event) {
        this.$emit('toggle-keyboard')
      }
    }
  }
</script>
<style lang="stylus">
  textarea#wat
    appearance: none
    transition-property: all
    transition-duration: 0.45s
    cursor: pointer
    transition-property: border-width, border-radius, text-align, background-color
    color: black
    @media (prefers-color-scheme: dark)
      color: white
    user-select: text
    border-style: solid
    resize: none
    caret-color: red
    &::placeholder
      transition-property: all
      font-family: inherit
    &:focus
      font-size: 1.25em
      font-weight: normal
      padding: 0
      // height: 100vh
      grid-column: 1 / span 2
      grid-row: 1 / span 3
      text-align: left
      border-top: none
      border-radius: 0
      border-width: 0
      background-color: transparent
      outline: 0
      transition-duration: .3s
      transition-property: all
      line-height: base-line
      &::placeholder
        color: red
        text-align: left
</style>
