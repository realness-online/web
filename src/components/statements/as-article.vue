<script>
  import { load, as_author, as_created_at } from '@/utils/itemid'
  import { as_time } from '@/utils/date'
  import Icon from '@/components/Icon'
  import as_statement from '@/components/statements/as-div'
  import as_avatar from '@/components/posters/as-svg'
  import as_messenger from '@/components/profile/as-messenger'
  export default {
    components: {
      icon: Icon,
      'as-avatar': as_avatar,
      'as-messenger': as_messenger,
      'as-statement': as_statement
    },
    props: {
      statements: {
        type: Array,
        required: true
      },
      verbose: {
        type: Boolean,
        required: false,
        default: false
      },
      editable: {
        type: Boolean,
        required: false,
        default: false
      }
    },
    emits: ['show', 'focused', 'blurred'],
    data() {
      return {
        observer: new IntersectionObserver(this.check_intersection, {
          rootMargin: '1024px 0px 0px 0px',
          threshold: 0
        }),
        all: null,
        author: null,
        focused: false
      }
    },
    computed: {
      thought_starts_at() {
        return as_time(as_created_at(this.statements[0].id))
      }
    },
    mounted() {
      this.observer.observe(this.$el)
    },
    beforeUnmount() {
      this.observer.unobserve(this.$el)
    },
    async created() {
      if (this.verbose) {
        const author_id = as_author(this.statements[0].id)
        if (author_id) this.author = await load(author_id)
      }
    },
    methods: {
      check_intersection(entries) {
        const entry = entries[0]
        if (entry.isIntersecting) {
          this.show()
          this.observer.unobserve(this.$el)
        }
      },
      click() {
        if (this.all) this.all = null
        else this.all = 'all'
      },
      show() {
        this.$emit('show', this.statements)
      },
      has_focus(statement) {
        this.focused = true
        this.$emit('focused', statement)
      },
      has_blurred(statement) {
        this.focused = false
        setTimeout(() => {
          if (!this.focused) this.$emit('blurred', statement)
        }, 750)
      }
    }
  }
</script>

<template>
  <article class="thought" :class="all" @click="click">
    <header v-if="author">
      <router-link :to="author.id" tabindex="-1">
        <as-avatar v-if="author.avatar" :itemid="author.avatar" class="icon" />
        <icon v-else name="silhouette" />
      </router-link>
      <address>
        <span>{{ author.first_name }}</span>
        <span>{{ author.last_name }}</span>
        <time>{{ thought_starts_at }}</time>
      </address>
      <menu>
        <as-messenger :itemid="author.id" />
      </menu>
    </header>
    <header v-else>
      <time>{{ thought_starts_at }}</time>
    </header>
    <as-statement
      v-for="statement in statements"
      :key="statement.id"
      itemprop="statements"
      :statement="statement"
      :editable="editable"
      @focused="has_focus"
      @blurred="has_blurred" />
  </article>
</template>

<style lang="stylus">
  article.thought
    & > header
      display: flex
      justify-content: flex-start
      flex-direction: row
      margin: 0 0 base-line 0
      & > a > svg
        width: base-line * 2
        height: base-line * 2
        min-height: inherit
        cursor: pointer
        shape-outside: circle()
        border-radius: (base-line * 2)
        margin-right: round((base-line / 4), 2)
        &.icon
          fill: blue
      & > address
        flex:1
        margin: 0
        & > span
          margin-right: round((base-line / 4), 2)
          font-weight: 300
          display: inline-block
      & > menu > a > svg
        fill: blue
        opacity: .25
        &:hover
        &:active
          opacity: 1
</style>
