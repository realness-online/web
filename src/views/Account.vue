<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import ProfileAsFigure from '@/components/profile/as-figure'
  import AsAddress from '@/components/profile/as-address'
  import AsSponsor from '@/components/account/as-sponsor'
  import Icon from '@/components/icon'
  import NameAsForm from '@/components/profile/as-form-name'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { current_user, me, sign_off } from '@/utils/serverless'
  import { watch } from 'vue'
  import { use_sponsor } from '@/use/sponsor'

  defineOptions({ name: 'Account' })

  const route = use_route()
  const router = use_router()
  const { sponsorships, record_session } = use_sponsor()

  watch(
    current_user,
    value => {
      if (value === null)
        router.replace({ path: '/sign-on', query: { next: '/account' } })
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
</script>

<template>
  <section v-if="me && current_user" id="account" class="page">
    <header>
      <logo-as-link />
      <profile-as-figure :person="me" display="label" />
    </header>
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
  </section>
</template>

<style lang="stylus">
  section#account.page
    padding: base-line
    margin: 0 auto
    & > header
      padding: 0
      display: flex
      justify-content: space-between
      align-items: center
      margin-bottom: base-line
      a.logo > svg.realness
        height: base-line * 2
        width: base-line * 2
      a.profile
        span
          display:none
        svg
          min-height: inherit
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
    @media (min-width: page-width-large)
      max-width: page-width-large
</style>
