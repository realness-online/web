<template>
  <section id="posters" class="page">
    <header>
      <a v-if="add" tabindex="-1" @click="select_photo">
        <icon name="add" />
      </a>
      <icon v-else name="nothing" />
      <h1>Posters</h1>
      <a v-if="add" id="camera" @click="open_camera">
        <icon name="camera" />
      </a>
      <input
        ref="uploader"
        v-uploader
        type="file"
        accept="image/jpeg,image/png" />
      <logo-as-link tabindex="-1" />
    </header>
    <icon v-if="working" name="working" />
    <article v-else>
      <as-figure
        v-if="new_poster"
        class="new"
        :itemid="as_itemid"
        :new_poster="new_poster"
        :working="working"
        @loaded="optimize">
        <menu>
          <a class="remove" @click="cancel_poster">
            <icon name="remove" />
          </a>
          <a v-if="new_poster.id" class="save" @click="save_poster">
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
        @click="menu_toggle(poster.id)">
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
  import { create_path_element } from '@/use/path-style'
  import { use as use_uploader } from '@/use/uploader'
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
  const vectorizer = new Worker('/vector.worker.js')
  const optimizer = new Worker('/optimize.worker.js')
  const working = ref(false)
  const new_poster = ref(null)
  const { posters, for_person: posters_for_person } = use_posters()
  const { vUploader, uploader, open_camera, select_photo } = use_uploader()

  const as_itemid = computed(() => {
    if (new_poster.value && new_poster.value.id) return new_poster.value.id
    else return `${localStorage.me}/posters/${Date.now()}`
  })
  const add = computed(() => {
    if (working.value || new_poster.value) return false
    else return true
  })
  const get_id = (name, type) => {
    return `${localStorage.me}/${type}/${name}`
  }
  const vectorize = image => {
    console.time('makes:poster')

    working.value = true
    vectorizer.postMessage({ image })
  }
  const vectorized = response => {
    const vector = response.data.vector
    vector.id = as_itemid
    vector.type = 'posters'
    vector.light = make_path(vector.light)
    vector.regular = make_path(vector.regular)
    vector.bold = make_path(vector.bold)
    new_poster.value = vector
    working.value = false
  }
  const make_path = path_data => {
    const path = create_path_element()
    path.setAttribute('d', path_data.d)
    path.style.fillOpacity = path_data.fillOpacity
    path.style.fillRule = 'evenodd'
    return path
  }
  const optimize = vector => {
    optimizer.postMessage({ vector })
  }
  const optimized = message => {
    const optimized = get_item(message.data.vector)
    new_poster.value = optimized
    console.timeEnd('makes:poster')
  }
  const save_poster = async () => {
    const id = new_poster.value.id
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
    new_poster.value = null
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
  const cancel_poster = () => (new_poster.value = null)
  const menu_toggle = itemid => {
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
    vectorizer.addEventListener('message', vectorized)
    optimizer.addEventListener('message', optimized)
    await posters_for_person({ id: localStorage.me })
    working.value = false
    console.info('views:Posters')
  })
  dismount(() => {
    vectorizer.terminate()
    optimizer.terminate()
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
