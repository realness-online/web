<template lang="html">
  <article itemscope itemtype="/post" :key="post.created_at" v-bind:class="{silent: post.muted}">
    <header v-if="me">
      <menu>
        <a @click="toggle_post(post)">
          <icon v-if="post.muted" name="add"></icon>
          <icon v-else name="remove"></icon>
        </a>
      </menu>
    </header>
    <meta itemprop="muted" v-if="post.muted" :content="post.muted">
    <time itemprop="created_at" :datetime="post.created_at">{{created_time(post.created_at)}}</time>
    <blockquote :contenteditable="me" @blur="changed" itemprop="articleBody">{{post.articleBody}}</blockquote>
  </article>
</template>
<script>
  import date_formating from '@/mixins/date_formating'
  import { posts_local } from '@/modules/LocalStorage'
  import icon from '@/components/icon'
  const options = { rootMargin: '0px 0px 64px 0px' }
  export default {
    mixins: [date_formating],
    components: {
      icon
    },
    props: {
      post: {
        type: Object,
        required: true
      },
      me: {
        type: Boolean,
        default: false
      }
    },
    data() {
      return {
        observer: new IntersectionObserver(this.end_of_articles, options)
      }
    },
    mounted() {
      // const selector = '[itemprop=posts]:last-of-type > .day:first-of-type > article:first-of-type'
      // const article = this.$el.querySelector(selector)
      // if (article) this.observer.observe(article)
    },
    created() {
    },
    destryed() {
      this.observer.disconnect()
    },
    computed: {
      i_am_oldest() {
        const my_posts = posts_local.as_list()
        const oldest = my_posts[my_posts.length - 1]
        if (this.post.created_at === oldest.created_at) return true
        else return false
      }
    },
    methods: {
      changed() {
        this.$nextTick(_ => posts_local.save())
      },
      toggle_post(post) {
        post.muted = !post.muted
        this.$nextTick(_ => posts_local.save())
      },
      async end_of_articles(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.observer.unobserve(entry.target)
            this.$emit('end-of-articles')
          }
        })
      }
    }
  }
</script>
<style lang="stylus"
  & > article
    margin-bottom: base-line
    & > header
      float:left
      shape-outside: circle()
      clip-path: circle(50%)
      & > menu svg
        padding-right: (base-line / 6)
        height: base-line
        width: base-line
        fill: white
    & > blockquote
      display: inline-block
      width:100%
    &.silent
      time
      blockquote
        color: white
</style>
