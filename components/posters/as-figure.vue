<template>
  <figure ref="poster" class="poster" :class="{ landscape }">
    <as-svg :itemid="itemid" @click="vector_click" @loaded="on_load" />
    <figcaption>
      <slot v-if="menu">
        <menu>
          <as-link :itemid="itemid">
            <time>{{ posted_at }}</time>
          </as-link>
          <as-download :itemid="itemid" />
          <as-messenger v-if="current_user" :itemid="itemid" />
        </menu>
      </slot>
    </figcaption>
  </figure>
</template>
<script setup>
  import AsDownload from '@/components/download-vector'
  import AsMessenger from '@/components/profile/as-messenger'
  import AsLink from '@/components/profile/as-link'
  import AsSvg from '@/components/posters/as-svg'
  import { as_query_id, as_author, load, as_created_at } from '@/use/itemid'
  import { is_vector, is_vector_id, is_click } from '@/use/vector'
  import { as_time } from '@/use/date'
  import { current_user } from '@/use/serverless'
  import {
    ref,
    computed,
    watchEffect as watch_effect,
    onUpdated as updated,
    nextTick as next_tick
  } from 'vue'
  const props = defineProps({
    slice: {
      type: Boolean,
      required: false,
      default: true
    },
    itemid: {
      type: String,
      required: true,
      validate: is_vector_id
    },
    working: {
      type: Boolean,
      required: false,
      default: false
    },
    immediate: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const menu = ref(false)
  const poster = ref(null)
  const vector = ref(null)
  const person = ref(null)
  const emit = defineEmits({
    'vector-click': is_click,
    loaded: is_vector
  })
  const landscape = computed(() => {
    if (!vector.value) return false
    const numbers = vector.value.viewbox.split(' ')
    const width = parseInt(numbers[2])
    const height = parseInt(numbers[3])
    return width > height
  })
  const query_id = computed(() => {
    return as_query_id(props.itemid)
  })
  const posted_at = computed(() => {
    return as_time(as_created_at(props.itemid))
  })
  const vector_click = () => {
    menu.value = !menu.value
    emit('vector-click', menu.value)
  }
  const on_load = async loaded_vector => {
    vector.value = loaded_vector
    await next_tick()
    emit('loaded', vector.value)
  }
  watch_effect(async () => {
    if (menu.value && !person.value) {
      const author_id = as_author(props.itemid)
      if (author_id) person.value = await load(author_id)
    }
  })
  updated(() => {
    const fragment = window.location.hash.substring(1)
    if (query_id.value === fragment) {
      poster.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.location.hash = ''
    }
  })
</script>
<style lang="stylus">
  figure.poster
    border-radius: round((base-line * .03), 2)
    position: relative
    overflow: hidden
    grid-row-start: span 2
    @media (orientation: landscape), (min-width: page-width)
      &.landscape
        grid-column-start: span 2
        &.new
          grid-column-start: span 3
    @media (min-width: pad-begins)
      &.new:not(.landscape)
        grid-column: 2
        grid-row: 2
    svg
      z-index: 1
      &[itemscope]
        transition-property: all
        position: relative
      &.working
        min-height: 512px
        margin-top: base-line
        max-width: round(base-line * 6)
    & > figcaption > menu
      height: 0
      & > a
        z-index: 2
        position: absolute
        @media (prefers-color-scheme: dark)
          &.phone > svg
          &.download > svg
            fill: blue
        &.phone
          top: base-line
          right: base-line
        &.download
          bottom: base-line
          right: base-line
        &.profile
          top: base-line
          left: base-line
          & > address
            & > h3:first-of-type
              margin-right: base-line * .333
            & > h3
            & > time
              color: blue
              line-height: 1
</style>
