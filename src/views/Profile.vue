<script setup>
  import AsDays from '@/components/as-days'
  import LogoAsLink from '@/components/logo-as-link'
  import AsDownload from '@/components/download-vector'
  import AsFigure from '@/components/profile/as-figure'
  import AsAvatar from '@/components/posters/as-svg'
  import AsPosterSymbol from '@/components/posters/as-poster-symbol'
  import AsMessenger from '@/components/profile/as-messenger'
  import ThoughtAsArticle from '@/components/thoughts/as-article'
  import PosterAsFigure from '@/components/posters/as-figure'
  import Icon from '@/components/icon'
  import NameAsForm from '@/components/profile/as-form-name'
  import AsSignOn from '@/components/profile/as-sign-on'

  import { use as use_statements, slot_key } from '@/use/statements'
  import { use_posters } from '@/use/poster'
  import { use_feed } from '@/use/feed'
  import { use as use_person, from_e64 } from '@/use/people'
  import { ref, provide, computed, watch, inject, nextTick as tick } from 'vue'
  import { useRoute as use_route } from 'vue-router'
  import { current_user, sign_off } from '@/utils/serverless'
  /** @typedef {import('@/types').Id} Id */
  import { as_layer_id, load_from_cache } from '@/utils/itemid'
  import { geology_layers } from '@/use/poster'
  import { menu } from '@/utils/preference'
  import { get } from 'idb-keyval'

  const route = use_route()
  const person_id = computed(() =>
    from_e64(String(route.params.phone_number ?? ''))
  )

  const is_own_profile = computed(() => {
    if (typeof localStorage === 'undefined') return false
    const mine = localStorage.me
    return !!(mine && person_id.value === mine)
  })

  const { load_person, person, people } = use_person()

  const scroll_account_into_view = () => {
    if (route.hash !== '#account') return
    if (!person.value || !is_own_profile.value) return
    tick().then(() => {
      document.getElementById('account')?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  const {
    statements,
    statement_shown,
    for_person: statements_for_person,
    update_statement
  } = use_statements()
  provide('update_statement', update_statement)
  const {
    posters,
    for_person: posters_for_person,
    poster_shown
  } = use_posters()
  const vector = ref(null)
  const shown = ref(false)
  provide('vector', vector)
  const feed_needs_refresh = inject('feed_needs_refresh', null)
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
    refresh_signal: feed_needs_refresh
  })

  const load_profile_feed = async id => {
    people.value = []
    shown.value = false
    vector.value = null
    await Promise.all([
      load_person({ id }),
      load_feed_for_people([id], { reset: true })
    ])
  }
  watch(person_id, id => load_profile_feed(id), { immediate: true })

  watch(
    [() => route.hash, person, is_own_profile],
    () => scroll_account_into_view(),
    { immediate: true }
  )

  const on_show = shown_vector => {
    if (!shown_vector) return
    vector.value = shown_vector
    if (!vector.value.cutouts) {
      vector.value.cutouts = {}
      geology_layers.forEach(layer => {
        const layer_id = as_layer_id(
          /** @type {Id} */ (person.value?.avatar),
          layer
        )
        get(layer_id).then(html_string => {
          if (html_string) vector.value.cutouts[layer] = true
        })
        load_from_cache(layer_id).then(({ html }) => {
          if (html) vector.value.cutouts[layer] = true
        })
      })
    }
    shown.value = true
  }

  const should_show_thought = (day, item) =>
    overlay_for_day(day).merged_thought_keys.has(slot_key(item)) === false
</script>

<template>
  <section id="profile" class="page">
    <header>
      <logo-as-link />
      <icon name="nothing" />
    </header>
    <div>
      <as-avatar
        v-if="person && person.avatar"
        as_avatar
        :itemid="person.avatar"
        @show="on_show" />
      <as-poster-symbol
        v-if="person?.avatar && shown"
        :itemid="person.avatar"
        :vector="vector"
        :shown="shown" />
      <menu v-if="person && person.avatar">
        <as-download v-if="person.avatar" :itemid="person.avatar" />
        <as-messenger :itemid="person.id" />
      </menu>
    </div>
    <as-figure v-if="person" :person="person" />
    <section
      v-if="person && is_own_profile"
      id="account"
      class="profile-account">
      <template v-if="current_user">
        <name-as-form />
        <fieldset id="sign-off">
          <legend>Sign off</legend>
          <button type="button" @click="sign_off">
            <icon name="arrow" /> sign off
          </button>
        </fieldset>
      </template>
      <as-sign-on v-else />
    </section>
    <as-days v-slot="{ day }" :posters="posters" :statements="statements">
      <template v-for="item in day" :key="slot_key(item)">
        <poster-as-figure
          v-if="item.type === 'posters'"
          :itemid="item.id"
          :menu="menu"
          :overlay_statements="overlay_statements_for_poster(day, item)"
          :overlay_editable="overlay_editable_for_poster(day, item)"
          @show="poster_shown" />
        <thought-as-article
          v-else-if="should_show_thought(day, item)"
          :statements="item"
          :editable="is_editable(item)"
          @show="statement_shown" />
      </template>
    </as-days>
  </section>
</template>

<style lang="stylus">
  section#profile
    padding: 0
    & > section.profile-account
      padding: base-line
      & > fieldset#sign-off
        margin-top: base-line
        border-top: 1px solid red
        display: flex
        align-items: center
        justify-content: flex-end
        gap: base-line * 0.25
        & > legend
          color: red
          margin-right: auto
        & > button
          margin: base-line * 0.75
          border-color: red
          &:hover
            background-color: red
            color: white
          & > svg.icon
            width: base-line
            height: base-line
    & > header
      height: 0
      padding: 0
      & > a
        -webkit-tap-highlight-color: blue
        z-index: 2
        top: safe_inset(top)
        left: base-line
        position: absolute
    & > div
      position: relative
      overflow: hidden
      & > svg
        width: 100dvw
        min-height: 100dvh
        &.working
          fill: blue
      & > menu
        width: 100%
        display: flex
        justify-content: space-between
        align-items: center
        gap: base-line * 0.5
        z-index: 1
        position: absolute
        bottom: -(base-line * 2)
        bottom: 0
        padding: 0 base-line
        animation: absolute-slide-up
        animation-delay: 1.33s
        animation-duration: 0.35s
        animation-fill-mode: both
        & > a
        & > nav
        & > button
          standard-shadow: boop
        & > a > svg
          fill: blue
    & > figure.profile
      padding: base-line
      & > svg
        border-radius: 0.66em
        width: base-line * 2
        height: base-line * 2
        border-radius: base-line
      & > figcaption > menu
        display:none
        a.status
          position: absolute
          top: base-line
          left: base-line
          animation: absolute-slide-down
          animation-delay: 1.33s
          animation-duration: 0.35s
          animation-fill-mode: both
          svg.add
            width: base-line * 2
            height: base-line * 2
          &.relation
            svg.add
              width: 0
              height: 0
            svg.finished
              width: base-line * 2
              height: base-line * 2
        a.phone
          display: none
    & > section.as-days
      .as-days-flow > article.day
        @media (prefers-color-scheme: dark)
          & > header > h4, figure.poster > svg.background
            color: blue
        figure.poster
          & > figcaption > menu
            & > a.download svg
              fill: blue
            & > a.phone
              display: none
            & > a.profile
            & > address
              & > time
                font-size: max-font
                color: blue
              & > h3
                display: none
            & > svg
              display: none
</style>
