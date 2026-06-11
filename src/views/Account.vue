<script setup>
  import SiteNav from '@/components/site-nav'
  import AsAddress from '@/components/profile/as-address'
  import AsSponsor from '@/components/account/as-sponsor'
  import Icon from '@/components/icon'
  import NameAsForm from '@/components/profile/as-form-name'
  import MobileAsForm from '@/components/profile/as-form-mobile'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { use_me } from '@/use/people'
  import { current_user, me, sign_off } from '@/utils/serverless'
  import { load, load_from_network } from '@/utils/itemid'
  import { keys, clear } from 'idb-keyval'
  import { ref, computed, watch, watchEffect as watch_effect } from 'vue'
  import { use_sponsor } from '@/use/sponsor'

  defineOptions({ name: 'Account' })

  const route = use_route()
  const router = use_router()
  const { is_valid_name, save } = use_me()
  const { sponsorships, record_session } = use_sponsor()

  const nameless = ref(false)
  const index_db_keys = ref([])
  const working = ref(false)

  const cleanable = computed(() => {
    if (working.value) return false
    if (current_user.value) return false
    if (localStorage.me && localStorage.me.length > 2) return true
    if (localStorage.length > 2) return true
    if (index_db_keys.value.length > 1) return true
    return false
  })

  const next_path = () => {
    const next = route.query?.next
    if (typeof next === 'string' && next.startsWith('/')) return next
    if (me.value?.id && me.value.id.length > 2) return me.value.id
    if (typeof localStorage !== 'undefined' && localStorage.me?.length > 2)
      return localStorage.me
    return '/'
  }

  const on_signed_in = () => {
    router.replace(next_path())
  }

  const signed_on = async () => {
    const network_profile = await load_from_network(localStorage.me)
    const local_profile = await load(localStorage.me)

    const my_profile = network_profile || local_profile
    if (my_profile) {
      const valid = is_valid_name.value
      if (valid) on_signed_in()
      else nameless.value = true
    } else nameless.value = true
  }

  const name_valid = async () => {
    await save()
    on_signed_in()
  }

  const clean = async () => {
    for (const key in localStorage)
      if (Object.prototype.hasOwnProperty.call(localStorage, key))
        localStorage.removeItem(key)
    localStorage.me = '/+'
    await clear()
    window.location.href = '/'
  }

  watch(
    current_user,
    value => {
      if (value === null) {
        nameless.value = false
        router.replace({ path: '/sign-on', query: { next: '/account' } })
      }
    },
    { immediate: true }
  )

  /* Capture Stripe Payment Link redirect once both auth + me are ready, then
     clear the query so a refresh does not double-record. */
  watch(
    () => [
      current_user.value,
      me.value?.id,
      route.query?.sponsor,
      route.query?.session_id
    ],
    async ([user, id, status, session_id]) => {
      if (!user) return
      if (typeof id !== 'string' || id.length <= 2) return
      if (status !== 'ok') return
      if (typeof session_id !== 'string' || !session_id) return
      const added = await record_session(session_id)
      if (added) router.replace({ path: '/account' })
    },
    { immediate: true }
  )

  watch_effect(() => {
    const valid = is_valid_name.value
    if (current_user.value && !valid) nameless.value = true
  })

  watch_effect(async () => {
    index_db_keys.value = await keys()
  })

  const signed_in = computed(() => !!me && !!current_user)
</script>

<template>
  <section id="account" class="page" outline>
    <header>
      <site-nav />
    </header>

    <!-- Signed in: account details -->
    <template v-if="me && current_user">
      <as-address :person="me">
        <template #action>
          <button type="button" @click="sign_off">
            <icon name="arrow" />
          </button>
        </template>

        <ol v-if="sponsorships.length" class="sponsorships">
          <li
            v-for="entry in sponsorships"
            :key="entry.session"
            itemprop="sponsorship"
            itemscope
            itemtype="/sponsorship">
            <time itemprop="at" :datetime="entry.at">{{ entry.at }}</time>
            <data itemprop="session" :value="entry.session">{{
              entry.session
            }}</data>
          </li>
        </ol>
      </as-address>
      <name-as-form />
      <as-sponsor />
    </template>

    <!-- Signed out: sign in forms -->
    <template v-else>
      <name-as-form v-if="nameless && current_user" @valid="name_valid" />
      <mobile-as-form
        v-else-if="!nameless || !current_user"
        @signed-on="signed_on"
        @working="working = $event" />
      <footer v-if="cleanable">
        <button @click="clean">Wipe</button>
      </footer>
    </template>
  </section>
</template>

<style lang="stylus">
  section#account.page
    margin: 0 auto
    & > header
      display: block
      padding: 0
      margin-bottom: base-line
    & > address > ol.sponsorships
      list-style: none
      padding: 0
      margin: (base-line * 0.5) 0 0
      display: flex
      flex-wrap: wrap
      gap: base-line * 0.25
      & > li
        font-size: 0.85em
        color: blue
        padding: (base-line * 0.15) (base-line * 0.4)
        background: black-transparent
        border-radius: base-line * 0.25
        & > data
          display: none
    & > menu.as-menu-account
      flex-direction: column
      align-items: stretch
      gap: base-line * 0.5
      max-width: page-width
      white-space: normal
    & > form
      max-width: base-line * 14
      margin-inline: auto
    & > footer > button
      margin: base-line
      opacity: 0.66
      font-size: 0.66em
      padding: (base-line * 0.125) (base-line * 0.25)
      line-height: 1.1
      border: none
      transition-property: opacity, border
      transition-duration: 0.33s
      transition-timing-function: ease
      &:hover
        opacity: 1
        border: 2px solid red
    @media (min-width: page-width-large)
      margin: autocomplete
</style>
