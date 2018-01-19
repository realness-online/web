<style src="./application.styl" lang="stylus"></style>
<template>
  <main id="social_network">

    <details>
      <summary>Activity</summary>
      <activity :activity="activity"></activity>
    </details>
    <details>
      <summary>Feed</summary>
    </details>
    <details>
      <summary>Friends</summary>
    </details>
    <details>
      <summary>Groups</summary>
    </details>
    <details>
      <summary>Events</summary>
    </details>
    <details>
      <summary>Wat</summary>
      <textarea id="wat" tabindex="1" placeholder="Wat?" v-model="new_post" v-on:focusout="add_post"></textarea>
      <posts :posts="posts">
      </posts>
    </details>
  </main>
</template>
<script>
  import posts from '@/components/profile-posts'
  import activity from '@/components/profile-activity'
  import Item from '@/modules/Item'
  import {posts_storage, activity_storage} from '@/modules/Storage'
  import '@/modules/timeago'

  export default {
    components: {
      posts,
      activity
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
