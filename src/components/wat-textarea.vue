<template lang="html">
  <textarea id="wat"
    v-model="new_post"
    v-on:focusout="add_post"
    v-on:focusin="enter_post_view"
    placeholder="Wat?"
    v-on:keyup.enter.prevent>
    {{ value }}</textarea>
</template>

<script>
  import Item from '@/modules/Item'
  import {posts_storage, activity_storage} from '@/modules/Storage'
  import autosize from 'autosize'
  export default {
    props: ['value'],
    ready() {
      autosize(this.$el)
    },
    data() {
      return {
        posts: Item.get_items(posts_storage.from_storage()),
        activity: Item.get_items(activity_storage.from_storage()),
        new_post: '',
        show: true
      }
    },
    methods: {
      add_post() {
        this.$emit('toggling')
        this.show = true
        window.location.hash = ''
        let created = new Date().toISOString()
        let value = this.new_post && this.new_post.trim()
        if (!value) { return }
        this.new_post = ''
        this.posts.push({
          articleBody: value,
          created_at: created
        })
        this.activity.push({
          who: `/users/uid`,
          what: 'Created a post',
          why: 'unknown',
          when: created,
          where: `/posts/1`
        })
      },
      enter_post_view() {
        this.$emit('toggling')
        this.show = false
        window.location.hash = 'wat'
      }
    }
  }
</script>

<style lang="stylus">
  @require '../application'
  textarea#wat
    transition-property: all
    transition-duration: 0.45s
    cursor:pointer
    transition-property: border-width, border-radius, text-align, background-color
    text-align:right
    color:black
    font-family: lato
    between: font-size
    user-select: text
    border-style: solid
    resize: none
    caret-color: red
    &:focus
      cursor: auto
      text-align: left
      width:100vw
      // min-height:100vh
      border-width:0
      border-radius: 0
      border-color:red
      background-color: transparent
      outline:0
      transition-duration: .3s
      transition-property: all
      line-height: base-line
      &::placeholder
        color:red
        transition-property:all
        text-align: left
</style>
