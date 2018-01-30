<template>
  <form id="create_post">
    <textarea id="wat"
      ref='wat'
      tabindex="1"
      placeholder="Wat?"
      v-model="new_post"
      v-on:focusout="add_post">
    </textarea>
    <menu>
      <input type="file" class="blue" name="photo" value="photo">
      <input type="file" class="green" name="" value="upload">
      <button>Done</button>
    </menu>
  </form>
</template>

<style lang="stylus">
  @require './application'
  form#create_post
    padding: base-line
    & > menu
      position: absolute;
      bottom: base-line
      padding: base-line
      resize: none
      display:flex
      justify-content: space-between;
      align-content: space-between
      & > input
        between: font-size
        border-radius:5vmax
        border-width: 2vh
        appearance: none
        display: inline-block
        width:33vw
        vertical-align: middle
        line-height: 1.33
        between: font-size
        transition-property: all
        outline: none
        box-shadow: none
        &::placeholder
          between: font-size
          text-align: center
  textarea#wat
    between: font-size
    user-select: text
    width:100vw
    height:50vh
    border-width:0
    border-radius: 0
    background-color: transparent
    &:focus
      outline:0
      transition-duration: .4s
      transition-property: line-height, padding
      line-height: base-line
      user-select: text
      &::placeholder
        text-align: left
</style>

<script>
  import Item from '@/modules/Item'
  import {posts_storage, activity_storage} from '@/modules/Storage'
  import posts_list from '@/components/posts-list'
  import activity_list from '@/components/activity-list'
  export default {
    mounted() {
      this.$nextTick(() => this.$refs.wat.focus())
      // this.$refs.wat.focus()
    },
    components: {
      'posts-list': posts_list,
      'activity-list': activity_list
    },
    data() {
      return {
        posts: Item.get_items(posts_storage.from_storage()),
        activity: Item.get_items(activity_storage.from_storage()),
        new_post: ''
      }
    },
    methods: {
      add_post() {
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
      }
    }
  }
</script>
