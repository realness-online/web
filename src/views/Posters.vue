<script setup>
  /** @typedef {import('@/types').Id} Id */
  import { onMounted as mounted } from 'vue'
  import Icon from '@/components/icon'
  import AsFigure from '@/components/posters/as-figure'
  import AsSvg from '@/components/posters/as-svg'
  import AsAuthorMenu from '@/components/posters/as-menu-author'
  import LogoAsLink from '@/components/logo-as-link'

  import { use as use_vectorize } from '@/use/vectorize'
  import { Poster } from '@/persistance/Storage'

  import { use_posters } from '@/use/poster'
  import { use as directory_processor } from '@/use/directory-processor'

  console.time('views:Posters')

  const { posters, for_person: posters_for_person } = use_posters()
  const {
    can_add,
    vVectorizer,
    image_picker,
    select_photo,
    working,
    mount_workers
  } = use_vectorize()
  const { process_directory, progress, completed_poster } = directory_processor()

  /**
   * @param {Id} id
   */
  const remove_poster = async id => {
    const message = 'Delete poster?'
    if (window.confirm(message)) {
      posters.value = posters.value.filter(item => item.id !== id)
      const poster = new Poster(id)
      await poster.delete()
    }
  }

  /**
   * @param {Id} itemid
   */
  const toggle_menu = itemid => {
    posters.value.forEach(poster => {
      if (poster.menu) poster.menu = false
    })
    const poster = posters.value.find(poster => poster.id === itemid)
    if (poster) poster.menu = !poster.menu
  }
  const picker = itemid => {
    const poster = posters.value.find(poster => poster.id === itemid)
    poster.picker = !poster.picker
  }

  mounted(async () => {
    mount_workers()
    await posters_for_person({ id: localStorage.me })
    working.value = false
    console.timeEnd('views:Posters')
  })
</script>

<template>
  <section id="posters" class="page">
    <header>
      <a v-if="can_add" tabindex="-1" @click="select_photo">
        <icon name="add" />
      </a>
      <a v-if="can_add" hidden tabindex="-1" @click="process_directory">
        <icon name="picker" />
      </a>

      <input
        ref="image_picker"
        v-vectorizer
        type="file"
        accept="image/jpeg,image/png" />
      <logo-as-link tabindex="-1" />
    </header>
    <h1>Posters</h1>
    <icon v-if="working" name="working" />
    <article v-else>
      <as-figure
        v-for="poster in posters"
        :key="poster.id"
        :itemid="poster.id"
        :class="{ 'selecting-event': poster.picker }"
        @click="() => toggle_menu(poster.id)">
        <as-author-menu
          :poster="poster"
          @remove="remove_poster"
          @picker="() => picker(poster.id)" />
      </as-figure>
    </article>
    <footer v-if="progress.processing" class="progress">
      <meter :value="progress.current" :max="progress.total" />
      <span>{{ progress.current }} / {{ progress.total }}</span>

      <div class="preview">
        <as-svg
          v-if="completed_poster"
          :vector="completed_poster"
          class="preview-poster" />
        <span>{{ progress.current_file }}</span>
      </div>
    </footer>
  </section>
</template>

<style lang="stylus">
  section#posters
    svg, a
      color: green
      fill: green
    & > header
      justify-content: space-between
    & > footer
      border-radius: base-line
      padding: base-line * 0.5
      background-color: black-transparent
      position: fixed
      bottom: base-line * 0.5
      left: s('calc( 50% - %s)', (base-line * 1.75) )
      z-index: 4
      @media (min-width: typing-begins)
        visibility: hidden
    & > h1
      @media (prefers-color-scheme: dark)
        color: green
    & > article
      standard-grid: gentle
      grid-gap: 0
      padding-bottom: base-line * 3
      @media (max-width: pad-begins)
        margin-top: base-line
      & > figure.poster
        &.selecting-event
          & > svg:not(.background)
            opacity: 0.1
</style>
