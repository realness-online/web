<script setup>
  import Icon from '@/components/icon'
  import AsFigure from '@/components/posters/as-figure'
  import AsAuthorMenu from '@/components/posters/as-menu-author'
  import LogoAsLink from '@/components/logo-as-link'

  import { use as use_vectorize } from '@/use/vectorize'
  import { Poster } from '@/persistance/Storage'
  import { onMounted as mounted } from 'vue'
  import { use_posters } from '@/use/vector'
  import { use_directory_processor } from '@/use/directory-processor'
  import { use as use_poster } from '@/use/poster'
  import { use as use_me } from '@/use/me'
  import { use as use_preferences } from '@/use/preferences'
  import { use as use_router } from '@/use/router'

  const { posters, for_person: posters_for_person } = use_posters()
  const {
    can_add,
    vVectorizer,
    image_picker,
    select_photo,
    working,
    mount_workers
  } = use_vectorize()
  const { process_directory, progress } = use_directory_processor()
  const { me } = use_me()
  const { preferences } = use_preferences()
  const { router } = use_router()

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
    console.info('views:/posters')
  })

  const current_preview = ref(null)
</script>

<template>
  <section id="posters" class="page">
    <header>
      <h1>Posters</h1>
      <nav v-if="can_add">
        <button @click="select_photo">
          <icon name="photo" />
          <span>Photo</span>
        </button>
        <button @click="open_selfie_camera">
          <icon name="selfie" />
          <span>Selfie</span>
        </button>
        <button @click="open_camera">
          <icon name="camera" />
          <span>Camera</span>
        </button>
        <button @click="process_directory">
          <icon name="picker" />
          <span>Directory</span>
        </button>
      </nav>

      <div v-if="progress.processing" class="progress">
        <meter
          :value="progress.current"
          :max="progress.total"
        />
        <span>{{ progress.current }} / {{ progress.total }}</span>

        <div v-if="current_preview" class="preview">
          <div class="preview-image" v-html="current_preview"></div>
          <span>{{ progress.current_file }}</span>
        </div>
      </div>
    </header>
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

nav button
  &:last-child
    background: var(--accent)
    color: var(--on-accent)

.progress
  margin-top: base-line
  display: flex
  flex-direction: column
  align-items: center
  gap: base-line

  meter
    width: 80%
    height: base-line

    &::-webkit-meter-bar
      background: var(--surface)
      border: 1px solid var(--outline)
      border-radius: base-line * 0.25

    &::-webkit-meter-optimum-value
      background: var(--accent)
      border-radius: base-line * 0.25

  span
    color: var(--on-surface)
    font-size: 0.9em

  .preview
    display: flex
    flex-direction: column
    align-items: center
    gap: base-line * 0.5

    .preview-image
      width: 120px
      height: 120px
      border-radius: base-line * 0.5
      background: var(--surface)
      padding: base-line * 0.5
      display: flex
      align-items: center
      justify-content: center

      :deep(svg)
        width: 100%
        height: 100%
        object-fit: contain

    span
      font-size: 0.8em
      opacity: 0.8
</style>
