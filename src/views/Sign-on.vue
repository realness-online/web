<template>
  <section id="sign-on" class="page">
    <header>
      <profile-as-figure v-if="person" :person="person">
        <p />
        <!-- defeat the default slot -->
      </profile-as-figure>
      <logo-as-link />
    </header>
    <mobile-as-form
      v-if="person && !nameless"
      v-model:person="person"
      @signed-on="signed_on" />
    <name-as-form v-if="nameless" v-model:person="person" @valid="new_person" />
    <footer>
      <button v-if="cleanable" @click="clean">Wipe</button>
    </footer>
  </section>
</template>
<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import ProfileAsFigure from '@/components/profile/as-figure'
  import MobileAsForm from '@/components/profile/as-form-mobile'
  import NameAsForm from '@/components/profile/as-form-name'

  import { keys, clear } from 'idb-keyval'
  import { load } from '@/use/itemid'
  import { Me } from '@/persistance/Storage'
  import { useRouter as use_router } from 'vue-router'
  import { current_user } from '@/use/serverless'
  import {
    ref,
    computed,
    nextTick as next_tick,
    watchEffect as watch_effect,
    onMounted as mounted
  } from 'vue'
  const router = use_router()
  const nameless = ref(false)
  const index_db_keys = ref([])
  const person = ref(null)
  const cleanable = computed(() => {
    if (current_user.value) return false
    if (localStorage.me.length > 2) return true
    if (localStorage.length > 2) return true
    if (index_db_keys.value.length > 0) return true
    else return false
  })
  const clean = async () => {
    localStorage.clear()
    localStorage.me = '/+'
    await clear()
    router.push({ path: '/' })
  }
  const signed_on = async () => {
    const my_profile = await load(localStorage.me)
    if (my_profile) router.push({ path: '/' })
    else nameless.value = true
  }
  const new_person = async () => {
    person.value.visited = new Date().toISOString()
    person.value.id = localStorage.me
    await next_tick()
    const me = new Me()
    await me.save()
    await next_tick()
    router.push({ path: '/account' })
  }
  mounted(async () => {
    person.value = await load(localStorage.me)
    if (!person.value) {
      person.value = {
        id: '/+',
        mobile: null
      }
    }
    index_db_keys.value = await keys()
    console.info('views:Sign-on')
  })
  watch_effect(() => {
    if (current_user.value) person.value.mobile = null
  })
</script>
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
      opacity: 0.5
      &:hover
        opacity: 1
    @media (min-width: pad-begins)
      form
        align-self: center
</style>
