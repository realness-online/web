<script setup>
  /**
   * @typedef {import('@/persistance/Storage').Statement} Statement
   */
  import {
    ref,
    computed,
    onMounted as mounted,
    onBeforeUnmount as before_unmounted
  } from 'vue'
  import { load, as_author, as_created_at } from '@/utils/itemid'
  import { as_time } from '@/utils/date'
  import Icon from '@/components/Icon'
  import AsStatement from '@/components/statements/as-div'
  import AsAvatar from '@/components/posters/as-svg'
  import AsMessenger from '@/components/profile/as-messenger'

  const props = defineProps({
    statements: {
      /** @type {import('vue').PropType<Statement[]>} */
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
  })

  const emit = defineEmits({
    show: (/** @type {Statement[]} */ statements) => Array.isArray(statements),
    focused: (/** @type {Statement} */ statement) =>
      statement && typeof statement === 'object',
    blurred: (/** @type {Statement} */ statement) =>
      statement && typeof statement === 'object'
  })

  const observer = ref(null)
  const all = ref(null)
  const author = ref(null)
  const focused = ref(false)
  const el = ref(null)
  const thought_starts_at = computed(() =>
    as_time(as_created_at(props.statements[0].id))
  )

  mounted(() => {
    observer.value = new IntersectionObserver(check_intersection, {
      rootMargin: '1024px 0px 0px 0px',
      threshold: 0
    })
    observer.value.observe(el.value)
    if (props.verbose) {
      const author_id = as_author(props.statements[0].id)
      if (author_id) load(author_id).then(result => (author.value = result))
    }
  })

  before_unmounted(() => {
    observer.value?.unobserve(el.value)
  })

  const check_intersection = entries => {
    const [entry] = entries
    if (entry.isIntersecting) {
      show()
      observer.value.unobserve(el.value)
    }
  }

  const click = () => (all.value = all.value ? null : 'all')

  const show = () => emit('show', props.statements)

  const has_focus = statement => {
    focused.value = true
    emit('focused', statement)
  }

  const BLUR_DELAY_MS = 750

  const has_blurred = statement => {
    focused.value = false
    setTimeout(() => {
      if (!focused.value) emit('blurred', statement)
    }, BLUR_DELAY_MS)
  }
</script>

<template>
  <article ref="el" class="thought" :class="all" @click="click">
    <header v-if="author">
      <router-link :to="author.id" tabindex="-1">
        <as-avatar v-if="author.avatar" :itemid="author.avatar" class="icon" />
        <icon v-else name="silhouette" />
      </router-link>
      <address>
        <span>{{ author.name }}</span>
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
          scale: 0.6
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
