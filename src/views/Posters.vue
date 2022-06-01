<template>
  <section id="posters" class="page">
    <header>
      <a v-if="can_add" tabindex="-1" @click="select_photo">
        <icon name="add" />
      </a>
      <icon v-else name="nothing" />
      <h1>Posters</h1>
      <a v-if="can_add" id="camera" @click="open_camera">
        <icon name="camera" />
      </a>
      <input
        ref="image_picker"
        v-vectorizer
        type="file"
        accept="image/jpeg,image/png" />
      <logo-as-link tabindex="-1" />
    </header>
    <icon v-if="working" name="working" />
    <article v-else>
      <as-figure
        v-for="poster in posters"
        :key="poster.id"
        :itemid="poster.id"
        :class="{ 'selecting-event': poster.picker }"
        @click="toggle_menu(poster.id)">
        <as-author-menu
          :poster="poster"
          @remove="remove_poster"
          @avatar="set_avatar"
          @picker="picker(poster.id)" />
      </as-figure>
    </article>
  </section>
</template>
<script setup>
  import icon from '@/components/icon'
  import AsFigure from '@/components/posters/as-figure'
  import AsAuthorMenu from '@/components/posters/as-menu-author'
  import LogoAsLink from '@/components/logo-as-link'

  import { use as use_vectorize } from '@/use/vectorize'
  import { Poster } from '@/persistance/Storage'
  import { onMounted as mounted } from 'vue'
  import { use_posters } from '@/use/vector'

  const { posters, for_person: posters_for_person } = use_posters()
  const {
    can_add,
    vVectorizer,
    image_picker,
    open_camera,
    select_photo,
    working,
    mount_workers
  } = use_vectorize()

  const remove_poster = async id => {
    const message = 'Delete poster?'
    if (window.confirm(message)) {
      posters.value = posters.value.filter(item => id !== item.id)
      const poster = new Poster(id)
      await poster.delete()
      console.info('delete:poster', id)
    }
  }
  const toggle_menu = itemid => {
    posters.value.forEach(poster => {
      if (poster.menu) poster.menu = false
    })
    const poster = posters.value.find(poster => poster.id === itemid)
    poster.menu = !poster.menu
  }
  const picker = itemid => {
    const poster = posters.value.find(poster => poster.id === itemid)
    poster.picker = !poster.picker
  }
  mounted(async () => {
    mount_workers()
    await posters_for_person({ id: localStorage.me })
    working.value = false
    console.info('views:/posters')
  })
</script>
<style lang="stylus">
  section#posters
    & > header
      justify-content: space-between
      @media (prefers-color-scheme: dark)
        & > h1
          color: green
      a#camera
        position: fixed
        bottom: base-line
        left: s('calc( 50% - %s)', (base-line * 1.25) )
        z-index: 4
        @media (min-width: typing-begins)
          visibility: hidden
    & header
      svg, a
        color: green
        fill: green
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
