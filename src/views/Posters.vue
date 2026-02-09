<script setup>
  /** @typedef {import('@/types').Id} Id */
  import {
    onMounted as mounted,
    ref,
    watch,
    nextTick as tick,
    inject
  } from 'vue'
  import Icon from '@/components/icon'
  import AsFigure from '@/components/posters/as-figure'
  import AsAuthorMenu from '@/components/posters/as-menu-author'
  import AsSvgProcessing from '@/components/posters/as-svg-processing'
  import LogoAsLink from '@/components/logo-as-link'
  import { as_created_at, load } from '@/utils/itemid'
  import { as_day_time_year } from '@/utils/date'
  import { Poster } from '@/persistance/Storage'
  import { use_posters } from '@/use/poster'

  import { use_keymap } from '@/use/key-commands'
  import { storytelling, slice } from '@/utils/preference'

  console.time('views:Posters')

  const {
    posters,
    for_person: posters_for_person,
    poster_shown
  } = use_posters()

  const select_photo = inject('select_photo')
  const can_add = inject('can_add')
  const init_processing_queue = inject('init_processing_queue')
  const queue_items = inject('queue_items')

  const poster_to_remove = ref(null)
  const delete_dialog = ref(null)

  /**
   * @param {Id} id
   */
  const remove_poster = async id => {
    poster_to_remove.value = await load(id)
    await tick()
    delete_dialog.value.showModal()
  }

  const confirmed_remove = () => {
    delete_dialog.value.close()
    posters.value = posters.value.filter(
      item => poster_to_remove.value.id !== item.id
    )
    const poster = new Poster(poster_to_remove.value.id)
    poster.delete()
  }

  const cancel_remove = () => delete_dialog.value.close()

  /**
   * @param {Id} itemid
   */
  const focus_poster = itemid => {
    const svg_element = document.querySelector(`svg[itemid="${itemid}"]`)
    if (!svg_element) return
    const poster_element = svg_element.closest('figure.poster')
    if (!poster_element) return
    /** @type {HTMLElement} */
    poster_element.focus()
  }

  /**
   * @param {Id} itemid
   */
  const handle_poster_click = itemid => {
    focus_poster(itemid)
  }

  const picker = itemid => {
    const poster = posters.value.find(poster => poster.id === itemid)
    if (poster) poster.picker = !poster.picker
  }

  const dialog_click = event => {
    if (event.target === delete_dialog.value) delete_dialog.value.close()
  }

  const { register } = use_keymap('Posters')

  const handle_focus = event => {
    if (!storytelling.value) return

    const focused_poster = event.target.closest('figure.poster')
    if (!focused_poster) return
    const article = /** @type {HTMLElement} */ (focused_poster).closest(
      'article'
    )
    if (!article) return

    // In storytelling mode, only scroll horizontally
    const poster_rect = /** @type {HTMLElement} */ (
      focused_poster
    ).getBoundingClientRect()
    const article_rect = article.getBoundingClientRect()
    const scroll_left =
      article.scrollLeft +
      (poster_rect.left -
        article_rect.left -
        article_rect.width / 2 +
        poster_rect.width / 2)

    article.scrollTo({
      left: scroll_left,
      behavior: 'smooth'
    })
  }

  register('poster::Create_New', () => {
    if (can_add.value) select_photo()
  })

  mounted(async () => {
    await posters_for_person({ id: localStorage.me })
    await init_processing_queue()
    console.timeEnd('views:Posters')
  })

  watch(
    queue_items,
    async (new_queue, old_queue) => {
      if (old_queue && new_queue.length < old_queue.length)
        await posters_for_person({ id: localStorage.me })
    },
    { deep: true }
  )
</script>

<template>
  <dialog
    v-if="poster_to_remove"
    ref="delete_dialog"
    class="confirm"
    @click="dialog_click">
    <article>
      <header>
        <h1>Delete Poster</h1>
      </header>
      <p>
        <i>Created:</i>
        {{ as_day_time_year(as_created_at(poster_to_remove.id)) }}
      </p>
      <menu>
        <button class="cancel" @click="cancel_remove">Cancel</button>
        <button class="delete" @click="confirmed_remove">Delete</button>
      </menu>
      <footer></footer>
    </article>
  </dialog>
  <section
    id="posters"
    class="page"
    :class="{ storytelling: storytelling, slice: slice }">
    <header>
      <a tabindex="-1" @click="select_photo">
        <icon name="add" />
      </a>
      <h1>Posters</h1>
      <logo-as-link tabindex="-1" />
    </header>

    <article @focusin="handle_focus">
      <as-svg-processing
        v-for="item in queue_items"
        :key="item.id"
        :queue_item="item" />

      <as-figure
        v-for="poster in posters"
        :key="poster.id"
        :itemid="poster.id"
        :menu="poster.menu"
        :slice="poster.slice"
        tabindex="0"
        :class="{
          'selecting-event': poster.picker,
          'fill-screen': poster.menu
        }"
        @click="handle_poster_click(poster.id)"
        @show="poster_shown">
        <as-author-menu
          :poster="poster"
          @remove="remove_poster"
          @picker="picker(poster.id)" />
      </as-figure>
    </article>
  </section>
</template>

<style lang="stylus">
  section#posters {
    svg, a {
      color: green;
      fill: green;
    }
    & > header {
      justify-content: space-between;
      margin-top: base-line
      & > h1 {
        @media (prefers-color-scheme: dark) {
          color: green;
        }
      }
    }
    & > footer {
      border-radius: base-line;
      padding: base-line * 0.5;
      background-color: black-transparent;
      position: fixed;
      bottom: base-line * 0.5;
      left: s('calc( 50% - %s)', (base-line * 1.75) );
      z-index: 4;
      @media (min-width: typing-begins) {
        visibility: hidden;
      }
    }

    & > article {
      standard-grid: gentle;
      grid-auto-flow: row;
      grid-gap: base-line;
      padding-bottom: base-line * 3;
      scroll-behavior: smooth;
      @media (max-width: pad-begins) {
        margin-top: base-line;
      }
      & > figure.poster.selecting-event > svg:not(.background) {
        opacity: 0.1;
      }
      & > figure.poster.processing.currently_processing {
        grid-column: 1 / -1;
      }
    }
    &.slice > article {
      grid-gap: 0;
    }
    &.storytelling {
      & header {
        display:none;
      }
      & > article {
        padding-bottom: 0
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        gap: base-line;
        scroll-behavior: smooth;
        height: 100vh;
        scroll-snap-type: x proximity;
        align-items: center;
        justify-content: start;
        & > figure.poster {
          height: 100%;
          flex-shrink: 0;
          scroll-snap-align: center;
          min-width: 100vw;
          animation: none;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          @media (max-aspect-ratio: 1 / 1) {
            max-width: 100vw;
          }
        }
      }
    }
  }
</style>
