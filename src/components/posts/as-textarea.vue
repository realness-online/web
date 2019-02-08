<template lang="html">
  <textarea id="wat"
    v-model="new_post"
    v-on:focusout="prepare_post"
    v-on:focusin="wat_focused"
    placeholder=">">{{value}}</textarea>
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
        post.articleBody = this.new_post && this.new_post.trim()
        if (!post.articleBody) { return }
        this.new_post = ''
        post.created_at = new Date().toISOString()
        post.updated_at = post.created_at
        this.$bus.$emit('post-added', post)
      },
      wat_focused($event) {
        this.$emit('toggle-keyboard')
      }
    }
  }
</script>
<style lang="stylus">
  @require '../../style/variables'
  textarea#wat
    transition-property: all
    transition-duration: 0.45s
    cursor:pointer
    transition-property: border-width, border-radius, text-align, background-color
    color:black
    font-family: 'Lato'
    font-size: inherit
    user-select: text
    border-style: solid
    resize: none
    caret-color: red
    padding-left: 1rem
    &::placeholder
      transition-property:all
      font-family: 'Lato'
    &:focus
      animation-name: slideInLeft
      font-weight: normal
      font-size:1.25em
      height:100vh
      text-align: left
      width:100vw
      border-top: none
      border-radius: 0
      border-width: 0
      background-color: transparent
      outline:0
      transition-duration: .3s
      transition-property: all
      line-height: base-line
      &::placeholder
        color:red
        text-align: left
</style>
