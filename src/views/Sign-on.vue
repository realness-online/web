<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import ProfileAsFigure from '@/components/profile/as-figure'
  import MobileAsForm from '@/components/profile/as-form-mobile'
  import NameAsForm from '@/components/profile/as-form-name'

  import { keys, clear } from 'idb-keyval'
  import { load } from '@/utils/itemid'
  import { use_me, default_person } from '@/use/people'
  import { useRouter as use_router } from 'vue-router'
  import { current_user } from '@/utils/serverless'
  import {
    ref,
    computed,
    watchEffect as watch_effect,
    onMounted as mounted
  } from 'vue'
  const router = use_router()
  const { me, is_valid_name } = use_me()
  const nameless = ref(false)
  const index_db_keys = ref([])
  const cleanable = computed(() => {
    if (current_user.value) return false
    if (localStorage.me.length > 2) return true
    if (localStorage.length > 2) return true
    if (index_db_keys.value.length > 1) return true
    return false
  })
  const clean = async () => {
    // Clear all items from localStorage
    for (const key in localStorage)
      if (localStorage.hasOwnProperty(key)) localStorage.removeItem(key)

    // Reset required values
    localStorage.me = '/+'
    me.value = default_person
    await clear()
    window.location.href = '/'
  }
  const signed_on = async () => {
    const my_profile = await load(localStorage.me)
    if (my_profile) router.push({ path: '/' })
    else new_person()
  }
  const new_person = () => {
    router.push({ path: '/phonebook' })
  }
  mounted(async () => {
    if (current_user.value) router.push({ path: '/' })
    index_db_keys.value = await keys()
    console.info('views:Sign-on')
  })
  watch_effect(async () => {
    const valid = await is_valid_name.value
    if (current_user.value && !valid) nameless.value = true
  })
</script>

<template>
  <section id="sign-on" class="page">
    <header>
      <profile-as-figure v-if="me" :person="me">
        <p />
        <!-- defeat the default slot -->
      </profile-as-figure>
      <logo-as-link />
    </header>
    <name-as-form v-if="nameless && current_user" />
    <mobile-as-form v-else @signed-on="signed_on" />
    <footer>
      <button v-if="cleanable" @click="clean">Wipe</button>
    </footer>
  </section>
</template>

<style lang="stylus">
  section#sign-on.page
    display: flex
    flex-direction: column
    justify-content: space-between
    figure.profile
      align-items: center
      & > svg
        border-radius: base-line * 2
        width: base-line * 2
        height: base-line * 2
        border-color: red
      & > figcaption
        padding: 0 0 0 round((base-line / 4 ), 2)
    svg.background
      fill: red
    form
    footer
      padding: base-line
      padding-top: 0
    & > footer > button
      position: absolute
      bottom: base-line * 3
      margin: 0 auto
      opacity: 0.5
      &:hover
        opacity: 1
    @media (min-width: pad-begins)
      form
        align-self: center
</style>
