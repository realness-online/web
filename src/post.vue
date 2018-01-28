<template lang="html">
  <section id="posts">
    <header>
      <textarea id="wat"
        tabindex="1"
        placeholder="Wat?"
        v-model="new_post"
        v-on:focusout="add_post">
      </textarea>
    </header>
    <posts :posts="posts"></posts>
  </section>
</template>
<script>
  import Item from '@/modules/Item'
  import {posts_storage, activity_storage} from '@/modules/Storage'
  export default {
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

<style lang="stylus">

</style>
