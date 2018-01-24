<style src="./application.styl" lang="stylus"></style>
<template>
  <main id="social_network">
    <nav id="main_nav">
      <a href="#profile" id="profile" class="black">Profile</a>
      <a href="#friends" id="friends" class="green">Friends</a>
      <a href="#groups"  id="groups"  class="green">Groups</a>
      <a href="#events"  id="events"  class="blue">Events</a>
      <a href="#feed"    id="feed"    class="blue">Feed</a>
      <a href="#post"    id="post"    class="red">Post</a>
    </nav>
    <section style="display:none">
      <textarea id="wat"
        tabindex="1"
        placeholder="Wat?"
        v-model="new_post"
        v-on:focusout="add_post">
      </textarea>
      <activity :activity="activity"></activity>
      <posts :posts="posts"></posts>
    </section>
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
