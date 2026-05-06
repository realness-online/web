<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import Icon from '@/components/icon'
  import AsSignOn from '@/components/profile/as-sign-on'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { me } from '@/utils/serverless'

  defineOptions({ name: 'SignOn' })

  const route = use_route()
  const router = use_router()

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
</script>

<template>
  <section id="sign-on-page" class="page">
    <header>
      <logo-as-link />
      <icon name="silhouette" />
    </header>
    <as-sign-on @signed_in="on_signed_in" />
  </section>
</template>

<style lang="stylus">
  section#sign-on-page.page
    padding: base-line
    max-width: page-width
    margin: 0 auto
    & > header
      display: flex
      justify-content: space-between
      align-items: center
      margin-bottom: base-line
      & > svg.icon
        width: base-line * 1.5
        height: base-line * 1.5
        fill: blue
    @media (min-width: page-width-large)
      max-width: page-width-large
</style>
