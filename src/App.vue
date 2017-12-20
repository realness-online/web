<style src="./application.styl" lang="stylus"></style>
<template>
  <main id="social_network">
    <header>
      <textarea tabindex="1" placeholder="Wat?" v-model="new_post" v-on:focusout="addPost"></textarea>
    </header>
    <details>
      <summary>Posts</summary>
      <posts v-bind:posts="posts">
      </posts>
    </details>
    <details>
      <summary>Activity</summary>
      <activity v-bind:activity="activity"></activity>
    </details>
  </main>
</template>
<script>
  import posts from './components/profile-posts'
  import activity from './components/profile-activity'
  import {posts_storage, activity_storage} from './modules/Storage'
  import './modules/timeago'

  export default {
    name: 'social-app',
    components: {
      posts,
      activity
    },
    data() {
      return {
        posts: posts_storage.load(),
        activity: activity_storage.load(),
        new_post: ''
      }
    },
    methods: {
      addPost() {
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
        console.log('create post activity', activity)
      }
    }
  }
</script>
