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
        v-if="new_vector"
        class="new"
        :itemid="as_new_itemid"
        :new_poster="new_vector"
        :working="working"
        @loaded="optimize">
        <menu>
          <a class="remove" @click="cancel_poster">
            <icon name="remove" />
          </a>
          <a v-if="new_vector.id" class="save" @click="save_poster">
            <icon name="finished" />
          </a>
        </menu>
      </as-figure>
      <as-figure
        v-for="poster in posters"
        v-else
        :key="poster.id"
        :itemid="poster.id"
        :class="{ 'selecting-event': poster.picker }"
        @click="toggle_menu(poster.id)">
        <as-author-menu
          :poster="poster"
          @remove="remove_poster"
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

  import { del } from 'idb-keyval'
  import get_item from '@/use/item'
  import { use as use_vectorize } from '@/use/vectorize'
  import { Poster } from '@/persistance/Storage'
  import {
    computed,
    ref,
    nextTick as next_tick,
    onMounted as mounted,
    onUnmounted as dismount
  } from 'vue'
  import { use_posters } from '@/use/vector'
  const finished = ref(true)

  const { posters, for_person: posters_for_person } = use_posters()
  const {
    can_add,
    vVectorizer,
    image_picker,
    open_camera,
    select_photo,
    working,
    as_new_itemid,
    optimize,
    new_vector
  } = use_vectorize()

  const save_poster = async () => {
    const id = new_vector.value.id
    if (!id) return null
    working.value = true
    const poster = new Poster(id)
    await poster.save()
    await next_tick()
    posters.value.unshift({
      id: id,
      menu: false,
      picker: false
    })
    new_vector.value = null
    working.value = false
    del(`${localStorage.me}/posters/`)
    // Creating a poster during a sync will sometimes
    // create a directory with only the poster you just createed
    console.info('save:poster', id)
  }
  const remove_poster = async id => {
    const message = 'Delete poster?'
    if (window.confirm(message)) {
      posters.value = posters.value.filter(item => id !== item.id)
      const poster = new Poster(id)
      await poster.delete()
      console.info('delete:poster', id)
    }
  }
  const cancel_poster = () => (new_vector.value = null)
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
      padding-bottom: base-line * 3
      @media (max-width: pad-begins)
        margin-top: base-line
      @media (min-width: pad-begins)
        grid-gap: 0
      & > figure.poster
        &.selecting-event
          & > svg:not(.background)
            opacity: 0.1
        & > figcaption > menu > a
          &.gear
            top: base-line
            right: base-line
          &.remove
            bottom: base-line
            left: base-line
          &.save
            bottom: base-line
            right: base-line
          &.event
            top: base-line
            left: base-line
          & > svg
            fill: green
</style>
