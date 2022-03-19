<template>
  <section id="feed" ref="feed" class="page">
    <header>
      <logo-as-link tabindex="-1" />
      <h1>Feed</h1>
      <icon v-if="is_fullscreen" name="nothing" />
      <a v-else tabindex="-1" @click="fullscreen">
        <icon name="fullscreen" />
      </a>
    </header>
    <as-days
      v-slot="items"
      :working="working"
      :posters="posters"
      :statements="statements">
      <template v-for="item in items">
        <poster-as-figure
          v-if="item.type === 'posters' || item.type === 'avatars'"
          :key="slot_key(item)"
          :itemid="item.id"
          :verbose="true" />
        <thought-as-article
          v-else
          :key="slot_key(item)"
          :statements="item"
          :verbose="true"
          @show="thought_shown" />
      </template>
    </as-days>
  </section>
</template>
<script setup>
  import icon from '@/components/icon'
  import logoAsLink from '@/components/logo-as-link'
  import asDays from '@/components/as-days'
  import thoughtAsArticle from '@/components/statements/as-article'
  import posterAsFigure from '@/components/posters/as-figure'
  import { list, as_directory, load } from '@/use/itemid'
  import { ref, computed, watch } from 'vue'
  import {
    useFullscreen as use_fullscreen,
    useMagicKeys as use_magic_keys
  } from '@vueuse/core'

  console.time('views:Feed')
  const working = ref(true)

  const posters = []
  const relations = await list(`${localStorage.me}/relations`)
  const count = ref(0)

  const show_message = computed(() => {
    if (this.working) return false
    if (this.statements.length === 0 && this.posters.length === 0) return true
    return false
  })

  await Promise.all(
    relations.map(async a => {
      const person = await load(a.id)
      if (person) authors.push(person)
    })
  )
  authors.push({
    id: localStorage.me,
    type: 'person'
  })

  await fill_feed()
  console.timeEnd('views:Feed')
  working.value = false

  const feed = ref(null)
  const { toggle: fullscreen, isFullscreen: is_fullscreen } =
    use_fullscreen(feed)

  const { f } = use_magic_keys()
  watch(f, v => {
    if (v) fullscreen()
  })
</script>
<style lang="stylus">
  section#feed
    position: relative
    display: flex
    flex-direction: column
    @media (max-width: pad-begins)
      figure.poster
        margin-left: -(base-line)
        margin-right: -(base-line)
    &:fullscreen
    &:full-screen
      background-color: black-background
      flex-direction: row
      overflow-x: auto
      display: flex;
      padding: 0
      & > header
      article.day > header
      article.thought
        display: none
      section.as-days
        white-space: nowrap;
        overflow-x: auto;
        scroll-behavior: smooth
        scroll-snap-type: both mandatory
        padding: 0
        margin: 0
        & > article.day
          scroll-behavior: smooth
          scroll-snap-type: both mandatory
          scroll-snap-align: start end
          display: flex
          flex-direction: row
          grid-gap:0
          margin: 0
          figure.poster
            scroll-behavior: smooth
            scroll-snap-align: center
            border-radius: 0
            min-width: 100vw
            height: 100vh
            figcaption
              display: none
    & > header
      & > h1
        width:auto
        color: blue
      & > a:hover > svg
        fill: green
        transition-timing-function: ease-out
      & > a > svg
        fill: blue
    & > nav
      display: none
    & > section.as-days
      & > article.day
        margin-bottom: base-line
        @media (prefers-color-scheme: dark)
          & > header h4, figure.poster > svg.background
            color: blue
</style>
