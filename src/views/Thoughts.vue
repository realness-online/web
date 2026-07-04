<script setup>
  /** @typedef {import('@/types').Id} Id */
  import {
    ref,
    computed,
    inject,
    provide,
    onMounted as mounted,
    watch,
    nextTick as tick
  } from 'vue'
  import AsDays from '@/components/as-days'
  import ThoughtAsArticle from '@/components/thoughts/as-article'
  import PosterAsFigure from '@/components/posters/as-figure'
  import AsSvgProcessing from '@/components/posters/as-svg-processing'
  import {
    as_created_at,
    load,
    as_type,
    feed_slot_itemid
  } from '@/utils/itemid'
  import { del } from 'idb-keyval'
  import { as_directory_id } from '@/persistence/Directory'
  import { as_day_time_year } from '@/utils/date'
  import { Poster } from '@/persistence/Storage'
  import { current_user } from '@/utils/serverless'
  import { use as use_statements } from '@/use/statements'
  import { use as use_people } from '@/use/people'
  import { use_posters } from '@/use/poster'
  import { use_feed } from '@/use/feed'
  import { use_keymap } from '@/use/key-commands'
  import {
    storytelling,
    aspect_ratio_mode,
    menu,
    only_mine
  } from '@/utils/preference'
  import { posting, scroll_position } from '@/use/posting'
  import { axis_visibility } from '@/utils/intersection'
  import { after_layout } from '@/utils/after-layout'
  import AsTextarea from '@/components/thoughts/as-textarea.vue'
  import AsFeedToggle from '@/components/thoughts/as-feed-toggle.vue'

  const from_blog = ref(
    new URLSearchParams(window.location.search).get('from') === 'blog'
      ? document.referrer || history.state?.back || ''
      : ''
  )

  const toggle_keyboard = active => {
    posting.value = active ?? !posting.value
  }

  const version = import.meta.env.PACKAGE_VERSION
  const version_parts = version.split('.')

  const set_working = inject('set_working')
  const select_photo = inject('select_photo')
  const init_processing_queue = inject('init_processing_queue')
  const queue_items = inject('queue_items')

  /** @type {import('vue').ComputedRef<import('@/persistence/Queue').QueueItem[]>} */
  const processing_items = computed(() => queue_items?.value ?? [])

  const working = ref(true)
  /** @type {import('vue').Ref<HTMLElement | null>} */
  const statements_ref = ref(null)
  /** @type {import('vue').Ref<import('@/types').Poster | null>} */
  const poster_to_remove = ref(null)
  /** @type {import('vue').Ref<HTMLDialogElement | null>} */
  const delete_dialog = ref(null)

  const { people, load_phonebook, phonebook } = use_people()
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

  const feed_needs_refresh = inject('feed_needs_refresh', null)
  /** @type {(reset?: boolean) => Promise<void>} */
  let fill_statements = async () => {}

  const {
    load_feed_for_people,
    is_editable,
    overlay_for_day,
    overlay_statements_for_poster,
    overlay_editable_for_poster
  } = use_feed({
    posters,
    statements,
    statements_for_person,
    posters_for_person,
    refresh_signal: feed_needs_refresh,
    queue_items,
    on_refresh: async () => {
      if (set_working) set_working(true)
      try {
        await load_phonebook()
        await fill_statements()
      } finally {
        if (set_working) set_working(false)
      }
    }
  })

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

  const remove_missing_poster = id => {
    posters.value = posters.value.filter(item => id !== item.id)
    void del(as_directory_id(id))
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

  /** Visibility dominates center distance when ranking posters in view. */
  const POSTER_VISIBILITY_WEIGHT = 1000

  /**
   * @param {number} visibility
   * @param {number} center
   * @param {number} mid
   */
  const poster_in_view_score = (visibility, center, mid) =>
    visibility * POSTER_VISIBILITY_WEIGHT - Math.abs(center - mid)

  const storytelling_scroll_container = () =>
    document.querySelector(
      'section.page.storytelling section.as-days > article'
    )

  /**
   * @param {Element | null | undefined} section
   * @param {ScrollBehavior} [behavior='smooth']
   */
  const scroll_storytelling_to_section = (section, behavior = 'smooth') => {
    const scroll_container = storytelling_scroll_container()
    if (!scroll_container || !section) return
    if (section.parentElement !== scroll_container) return
    const slide_rect = section.getBoundingClientRect()
    const container_rect = scroll_container.getBoundingClientRect()
    const scroll_left =
      scroll_container.scrollLeft +
      (slide_rect.left -
        container_rect.left -
        container_rect.width / 2 +
        slide_rect.width / 2)
    scroll_container.scrollTo({ left: scroll_left, behavior })
  }

  /** @param {HTMLElement} figure */
  const poster_itemid_from_figure = figure => {
    const id_el = figure.querySelector('[itemid]')
    return id_el?.getAttribute('itemid') || null
  }

  /** @param {HTMLElement} root */
  const poster_itemid_most_in_view = root => {
    let best_itemid = null
    let best_score = -Infinity
    const mid = window.innerHeight / 2
    for (const figure of root.querySelectorAll('figure.poster')) {
      if (!(figure instanceof HTMLElement)) continue
      const rect = figure.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue
      const visible =
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
      const visibility = axis_visibility(
        visible,
        rect.height,
        window.innerHeight
      )
      const center = rect.top + rect.height / 2
      const score = poster_in_view_score(visibility, center, mid)
      if (score <= best_score) continue
      best_score = score
      best_itemid = poster_itemid_from_figure(figure)
    }
    return best_itemid
  }

  const storytelling_poster_itemid = () => {
    const root = statements_ref.value
    if (!root) return null
    const active = document.activeElement
    const focused =
      active instanceof HTMLElement ? active.closest('figure.poster') : null
    if (focused instanceof HTMLElement && root.contains(focused)) {
      const itemid = poster_itemid_from_figure(focused)
      if (itemid) return itemid
    }
    const scroll_container = storytelling_scroll_container()
    if (!scroll_container) return null
    let best_itemid = null
    let best_score = -Infinity
    const container_rect = scroll_container.getBoundingClientRect()
    const mid = container_rect.left + container_rect.width / 2
    for (const section of scroll_container.querySelectorAll(
      ':scope > section'
    )) {
      const figure = section.querySelector('figure.poster')
      if (!(figure instanceof HTMLElement)) continue
      const rect = section.getBoundingClientRect()
      if (rect.right < container_rect.left || rect.left > container_rect.right)
        continue
      const visible =
        Math.min(rect.right, container_rect.right) -
        Math.max(rect.left, container_rect.left)
      const visibility = axis_visibility(
        visible,
        rect.width,
        container_rect.width
      )
      const center = rect.left + rect.width / 2
      const score = poster_in_view_score(visibility, center, mid)
      if (score <= best_score) continue
      best_score = score
      best_itemid = poster_itemid_from_figure(figure)
    }
    return best_itemid
  }

  const focused_poster_itemid = () => {
    const root = statements_ref.value
    if (!root) return null
    const active = document.activeElement
    const focused =
      active instanceof HTMLElement ? active.closest('figure.poster') : null
    if (focused instanceof HTMLElement && root.contains(focused)) {
      const itemid = poster_itemid_from_figure(focused)
      if (itemid) return itemid
    }
    return poster_itemid_most_in_view(root)
  }

  /**
   * @param {string} itemid
   * @param {ScrollBehavior} [behavior='smooth']
   */
  const scroll_feed_to_itemid = (itemid, behavior = 'smooth') => {
    const root = statements_ref.value
    if (!root || !itemid) return
    const escaped = CSS.escape(itemid)
    const figure = root
      .querySelector(`figure.poster [itemid="${escaped}"]`)
      ?.closest('figure.poster')
    if (!(figure instanceof HTMLElement)) return
    figure.scrollIntoView({ block: 'center', behavior })
    figure.focus()
  }

  /**
   * @param {string} itemid
   * @param {ScrollBehavior} [behavior='smooth']
   */
  const scroll_storytelling_to_itemid = (itemid, behavior = 'smooth') => {
    if (!itemid) return
    const escaped = CSS.escape(itemid)
    const figure = document.querySelector(
      `section.page.storytelling figure.poster [itemid="${escaped}"]`
    )
    const section = figure?.closest('section')
    scroll_storytelling_to_section(section, behavior)
  }

  const handle_focus = event => {
    if (!storytelling.value) return
    scroll_storytelling_to_section(event.target.closest('section'))
  }

  watch(
    storytelling,
    async (is_on, was_on) => {
      if (is_on && !was_on) {
        const itemid = focused_poster_itemid()
        if (!itemid) return
        await tick()
        await after_layout()
        scroll_storytelling_to_itemid(itemid, 'auto')
        return
      }
      if (!is_on && was_on) {
        const itemid = storytelling_poster_itemid()
        if (!itemid) return
        await tick()
        await after_layout()
        scroll_feed_to_itemid(itemid, 'auto')
      }
    },
    { flush: 'pre' }
  )

  fill_statements = async (reset = false) => {
    const my_id =
      (typeof window !== 'undefined' ? window.localStorage?.me : null) ?? null

    if (only_mine.value)
      people.value =
        my_id && my_id.length > 2 ? [{ id: my_id, type: 'person' }] : []
    else {
      if (phonebook.value.length)
        people.value = /** @type {import('@/types').Item[]} */ ([
          ...phonebook.value
        ])
      if (my_id && !people.value.some(p => p.id === my_id))
        people.value.push({ id: my_id, type: 'person' })
      const admin_raw = import.meta.env.VITE_ADMIN_ID
      const admin_itemid = admin_raw
        ? /** @type {Id} */ (`/${String(admin_raw).replace(/^\/?/, '')}`)
        : null
      if (
        !current_user.value &&
        admin_itemid &&
        !people.value.some(p => p.id === admin_itemid)
      )
        people.value.push({
          id: admin_itemid,
          type: 'person'
        })
    }

    await load_feed_for_people(
      /** @type {Id[]} */ (people.value.map(relation => relation.id)),
      { reset }
    )
  }

  const mark_thoughts_rendered = async () => {
    if (typeof window === 'undefined') return
    const perf = window.performance
    if (!perf?.mark) return

    await tick()
    await after_layout()

    perf.clearMarks('thoughts-rendered')
    perf.mark('thoughts-rendered')
  }

  const { register } = use_keymap('Thoughts')
  register('poster::Create_New', () => select_photo?.())

  watch(
    () => current_user.value,
    async user => {
      if (!user) return
      await load_phonebook()
      await fill_statements()
    }
  )

  watch(only_mine, async () => {
    if (set_working) set_working(true)
    try {
      await fill_statements(true)
    } finally {
      if (set_working) set_working(false)
    }
  })

  mounted(async () => {
    if (set_working) set_working(true)
    await load_phonebook()
    await fill_statements()
    await init_processing_queue?.()
    working.value = false
    if (set_working) set_working(false)
    await mark_thoughts_rendered()
  })

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
      <as-feed-toggle v-model="only_mine" />
      <a v-if="from_blog" :href="from_blog">←</a>
      <router-link id="about" to="/about" tabindex="-1">
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
          const first = /** @type {HTMLElement | null} */ (
            statements_ref?.querySelector('figure.poster')
          )
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
      <template v-for="item in day" :key="feed_slot_itemid(item)">
        <poster-as-figure
          v-if="
            (item.type === 'posters' ||
              as_type(feed_slot_itemid(item)) === 'posters') &&
            !posting
          "
          :itemid="feed_slot_itemid(item)"
          :menu="menu"
          :slice="aspect_ratio_mode !== 'auto'"
          :overlay_statements="overlay_statements_for_poster(day, item)"
          :overlay_editable="overlay_editable_for_poster(day, item)"
          tabindex="0"
          :class="{ 'fill-screen': menu }"
          @show="poster_shown"
          @remove="remove_poster"
          @missing="remove_missing_poster" />
        <thought-as-article
          v-else-if="
            item.type !== 'posters' &&
            !overlay_for_day(day).merged_thought_keys.has(
              feed_slot_itemid(item)
            )
          "
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
    & > section.as-days {
      padding-left: 0;
      padding-right: 0;
      & [role='feed'] > article > header {
        padding-left: base-line;
        padding-right: base-line;
      }
      & article.thought {
        padding-left: base-line;
        padding-right: base-line;
      }
      & [role='feed'] > article figure.poster {
        border-radius: 0;
      }
      & [role='feed'] > article {
        @media (prefers-color-scheme: dark) {
          & > header h4, figure.poster > svg.background {
            color: accent;
          }
        }
      }
      & h4 {
        margin: base-line 0 0 0;
      }
      & [role='feed'] > article p[itemprop='statement']:focus {
        font-weight: bolder;
        outline: 0;
      }
    }
    &.storytelling {
      flex: 1;
      min-height: 100vh;
      & > header,
      & > h1,
      & > section.processing,
      & > .posting-input {
        display: none;
      }
    }
    & > header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: base-line;
      color: accent;
      & > h1 {
        width: auto;
      }
      & > a > svg {
        fill: accent;
      }
      & > a#about {
        margin-left: auto;
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
          transition-property: opacity, color;
          transition-timing-function: ease;
          transition-duration: 0.66s;
          @media (prefers-reduced-motion: reduce) {
            transition-duration: 0.01ms;
          }
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
          transform: scale(1);
          transition-property: transform, color;
          transition-timing-function: cubic-bezier(0.34, 1.45, 0.64, 1);
          transition-duration: 0.66s;
          @media (prefers-reduced-motion: reduce) {
            transition-duration: 0.01ms;
          }
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
        @media (hover: hover) and (pointer: fine) {
          &:hover {
            & > span:nth-child(2) {
              color: emphasis;
              transform: scale(1.15);
              @media (prefers-reduced-motion: reduce) {
                transform: scale(1);
              }
            }
            & > span:not(:nth-child(2)) {
              opacity: 0.3;
            }
          }
        }
      }
    }
    & > nav {
      display: none;
    }
    .working {
      fill: accent;
    }
  }
</style>
