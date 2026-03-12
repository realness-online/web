<script setup>
  /** @typedef {import('@/types').Id} Id */
  import {
    ref,
    computed,
    inject,
    provide,
    onMounted as mounted,
    onBeforeUnmount as before_unmount,
    watch,
    nextTick as tick
  } from 'vue'
  import AsDays from '@/components/as-days'
  import ThoughtAsArticle from '@/components/thoughts/as-article'
  import PosterAsFigure from '@/components/posters/as-figure'
  import AsAuthorMenu from '@/components/posters/as-menu-author'
  import AsSvgProcessing from '@/components/posters/as-svg-processing'
  import AsDialogAccount from '@/components/profile/as-dialog-account.vue'

  import { as_author, as_created_at, load } from '@/utils/itemid'
  import { as_day_time_year } from '@/utils/date'
  import { Poster } from '@/persistance/Storage'
  import { use as use_statements, slot_key } from '@/use/statements'
  import { use as use_people, use_me } from '@/use/people'
  import { use_posters } from '@/use/poster'
  import { use_keymap } from '@/use/key-commands'
  import { storytelling, aspect_ratio_mode, menu } from '@/utils/preference'
  import { posting, scroll_position } from '@/use/posting'
  import AsTextarea from '@/components/thoughts/as-textarea.vue'

  const toggle_keyboard = active => {
    posting.value = active ?? !posting.value
  }

  const version = import.meta.env.PACKAGE_VERSION
  const version_parts = version.split('.')

  console.time('views:Thoughts')

  const set_working = inject('set_working')
  const select_photo = inject('select_photo')
  const can_add = inject('can_add')
  const register_account = inject('register_account')
  const account_dialog = ref(null)
  const init_processing_queue = inject('init_processing_queue')
  const queue_items = inject('queue_items')

  /** @type {import('vue').ComputedRef<import('@/persistance/Queue').QueueItem[]>} */
  const processing_items = computed(() => queue_items?.value ?? [])

  const working = ref(true)
  const statements_ref = ref(null)
  /** @type {import('vue').Ref<import('@/types').Poster | null>} */
  const poster_to_remove = ref(null)
  /** @type {import('vue').Ref<HTMLDialogElement | null>} */
  const delete_dialog = ref(null)

  const { people } = use_people()
  const {
    for_person: statements_for_person,
    statements,
    statement_shown,
    update_statement
  } = use_statements()
  provide('update_statement', update_statement)
  const {
    for_person: posters_for_person,
    poster_shown,
    posters
  } = use_posters()
  const { relations } = use_me()

  const me_id = () =>
    (typeof window !== 'undefined' ? window.localStorage?.me : null) ?? null
  const is_editable = item => {
    const my_id = me_id()
    if (!my_id) return false
    return as_author(item?.[0]?.id) === my_id
  }
  const is_own_poster = item =>
    me_id() && item?.id && as_author(item.id) === me_id()

  const is_picker_selected = item =>
    !!(/** @type {{picker?: boolean}} */ (item).picker)

  /**
   * @param {Id} id
   */
  const remove_poster = async id => {
    const loaded = await load(id)
    if (!loaded) return
    poster_to_remove.value = /** @type {import('@/types').Poster} */ (loaded)
    await tick()
    if (delete_dialog.value) delete_dialog.value.showModal()
  }

  const confirmed_remove = async () => {
    const to_remove = poster_to_remove.value
    if (!to_remove || !delete_dialog.value) return
    delete_dialog.value.close()
    posters.value = posters.value.filter(item => to_remove.id !== item.id)
    const poster = new Poster(to_remove.id)
    await poster.delete()
  }

  const cancel_remove = () => {
    if (delete_dialog.value) delete_dialog.value.close()
  }

  const dialog_click = event => {
    if (event.target === delete_dialog.value && delete_dialog.value)
      delete_dialog.value.close()
  }

  const handle_focus = event => {
    if (!storytelling.value) return
    const scroll_container = document.querySelector(
      'section.page.storytelling section.as-days > article'
    )
    if (!scroll_container) return
    const focused_slide = event.target.closest('section')
    if (!focused_slide || focused_slide.parentElement !== scroll_container)
      return
    const slide_rect = focused_slide.getBoundingClientRect()
    const container_rect = scroll_container.getBoundingClientRect()
    const scroll_left =
      scroll_container.scrollLeft +
      (slide_rect.left -
        container_rect.left -
        container_rect.width / 2 +
        slide_rect.width / 2)
    scroll_container.scrollTo({
      left: scroll_left,
      behavior: 'smooth'
    })
  }

  const picker = itemid => {
    const poster =
      /** @type {import('@/types').Poster & {picker?: boolean}} */ (
        posters.value.find(p => p.id === itemid)
      )
    if (poster) poster.picker = !poster.picker
  }

  const fill_statements = async () => {
    if (relations.value)
      people.value = /** @type {import('@/types').Item[]} */ ([
        ...relations.value
      ])
    const my_id = me_id()
    if (my_id) people.value.push({ id: my_id, type: 'person' })

    await Promise.all(
      people.value.map(async relation => {
        await Promise.all([
          statements_for_person({ id: relation.id }),
          posters_for_person({ id: relation.id })
        ])
      })
    )
  }

  const { register } = use_keymap('Thoughts')
  register('poster::Create_New', () => {
    if (can_add?.value) select_photo?.()
  })

  mounted(async () => {
    if (register_account) register_account(() => account_dialog.value?.show())
    if (set_working) set_working(true)
    await fill_statements()
    await init_processing_queue?.()
    working.value = false
    if (set_working) set_working(false)
    console.timeEnd('views:Thoughts')
  })

  before_unmount(() => {
    if (register_account) register_account(null)
  })

  if (queue_items)
    watch(
      queue_items,
      async (new_queue, old_queue) => {
        if (old_queue && new_queue?.length < old_queue.length)
          await fill_statements()
      },
      { deep: true }
    )

  watch(posting, async (now, was) => {
    if (was && !now && scroll_position.value !== null) {
      await tick()
      window.scrollTo(0, scroll_position.value)
      scroll_position.value = null
    }
  })
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
    id="thoughts"
    ref="statements_ref"
    class="page"
    :class="{
      storytelling: storytelling,
      slice: aspect_ratio_mode !== 'auto',
      menu
    }">
    <header>
      <as-dialog-account v-if="!posting" ref="account_dialog" />
      <router-link v-if="!posting" id="about" to="/about" tabindex="-1">
        <span>{{ version_parts[0] }}</span>
        <span>?</span>
        <span>{{ version_parts[1] }}</span>
        <span>{{ version_parts[2] }}</span>
      </router-link>
    </header>
    <h1>Thoughts</h1>
    <as-textarea
      @toggle-keyboard="toggle_keyboard"
      @tab-next="
        e => {
          const first = statements_ref?.querySelector('figure.poster')
          if (first) {
            e.preventDefault()
            first.focus()
          }
        }
      " />
    <section v-if="processing_items.length" class="processing">
      <as-svg-processing
        v-for="item in processing_items"
        :key="item.id"
        :queue_item="item" />
    </section>

    <as-days
      v-slot="{ day }"
      :working="working"
      :posters="posters"
      :statements="statements"
      :storytelling="storytelling"
      itemscope
      @focusin="handle_focus">
      <template v-for="item in day" :key="slot_key(item)">
        <poster-as-figure
          v-if="item.type === 'posters' && !posting"
          :itemid="item.id"
          :menu="menu"
          :slice="aspect_ratio_mode !== 'auto'"
          tabindex="0"
          :class="{
            'selecting-event': is_picker_selected(item),
            'fill-screen': menu
          }"
          @show="poster_shown">
          <as-author-menu
            v-if="is_own_poster(item)"
            :poster="item"
            @remove="remove_poster"
            @picker="picker" />
        </poster-as-figure>
        <thought-as-article
          v-else-if="item.type !== 'posters'"
          :statements="item"
          :editable="is_editable(item)"
          verbose
          @show="statement_shown" />
      </template>
    </as-days>
  </section>
</template>

<style lang="stylus">
  section#thoughts {
    position: relative;
    display: flex;
    flex-direction: column;
    & > section.processing {
      standard-grid: gentle;
      grid-auto-flow: row;
      grid-gap: base-line;
      padding: 0 base-line;
      margin-bottom: base-line;
      @media (min-width: page-width-large) {
        grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      }
      & > figure.poster.processing.currently_processing {
        grid-column: 1 / -1;
      }
    }
    &.slice > section.processing {
      grid-gap: 0;
    }
    & > section.as-days figure.poster.selecting-event > svg:not(.background) {
      opacity: 0.1;
    }
    & > section.as-days figure.poster > figcaption > menu {
      pointer-events: auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: base-line * 0.5;
      padding: base-line * 0.5;
      margin: base-line;
      height: auto;
      border-radius: base-line;
      background: black-transparent;
      & > a, & > button {
        &.remove {
          standard-shadow: boop;
        }
        & > svg {
          fill: blue;
        }
      }
      & > button {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: base-line * 0.25;
        padding: base-line * 0.25 base-line * 0.5;
        cursor: pointer;
        color: inherit;
        font-size: larger;
        line-height: 1;
        opacity: 0.7;
        min-width: base-line * 1.5;
        text-align: center;
        &:hover {
          opacity: 1;
          background: rgba(0, 0, 0, 0.5);
        }
        &:focus {
          outline: 0.25px solid currentColor;
          outline-offset: base-line * 0.25;
          opacity: 1;
        }
      }
    }
    @media (max-width: pad-begins) {
      & > section.as-days {
        padding-left: 0;
        padding-right: 0;
      }
      & > section.as-days article.day > header {
        padding-left: base-line;
        padding-right: base-line;
      }
      & > section.as-days article.thought {
        padding-left: base-line;
        padding-right: base-line;
      }
    }
    &.storytelling {
      flex: 1;
      min-height: 100vh;
      & > header,
      & > h1,
      & > section.processing {
        display: none;
      }
    }
    & > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: base-line;
      color: blue;
      & > h1 {
        width: auto;
      }
      & > a > svg {
        fill: blue;
      }
      & > a#about {

        font-weight: bold;
        font-size: base-line * 1.44;
        -webkit-user-select: none;
        user-select: none;
        display: grid;
        grid-template-columns: auto auto auto;
        grid-template-rows: auto auto;
        align-items: baseline;
        & > span {
          font-size: 0.266em;
          vertical-align: sub;
          opacity: 0.67;
        }
        & > span:first-child {
          grid-column: 1;
          grid-row: 1;
          margin-right: 0.1em;
          margin-left: -(base-line * 0.25);
        }
        & > span:nth-child(2) {
          grid-column: 2;
          grid-row: 1;
          font-size: 1em;
          opacity: 1;
        }
        & > span:nth-child(3) {
          grid-column: 2;
          grid-row: 2;
          justify-self: center;
          transform: translateY(-(base-line * 0.25));
        }
        & > span:last-child {
          grid-column: 3;
          grid-row: 1;
          margin-left: 0.1em;
          margin-right: -(base-line * 0.25);
        }
      }
    }
    & > nav {
      display: none;
    }
    & > section.as-days {
      & > article.day {
        margin-bottom: base-line;
        @media (prefers-color-scheme: dark) {
          & > header h4, figure.poster > svg.background {
            color: blue;
          }
        }
      }
      h4 {
        margin: base-line 0 0 0;
      }
      article.day p[itemprop='statement']:focus {
        font-weight: bolder;
        outline: 0;
      }
    }
    .working {
      fill: blue;
    }
  }
</style>
