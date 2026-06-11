<script setup>
  import SiteNav from '@/components/site-nav'
  import MobileAsForm from '@/components/profile/as-form-mobile'
  import NameAsForm from '@/components/profile/as-form-name'
  import { load, load_from_network } from '@/utils/itemid'
  import { use_me } from '@/use/people'
  import { current_user, me } from '@/utils/serverless'
  import { keys, clear } from 'idb-keyval'
  import { ref, computed, watchEffect as watch_effect } from 'vue'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'

  defineOptions({ name: 'SignOn' })

  const route = use_route()
  const router = use_router()
  const { is_valid_name, save } = use_me()
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

  watch_effect(() => {
    const valid = is_valid_name.value
    if (current_user.value && !valid) nameless.value = true
  })

  watch_effect(async () => {
    index_db_keys.value = await keys()
  })
</script>

<template>
  <section id="sign-on" class="page">
    <header>
      <site-nav />
    </header>
    <name-as-form v-if="nameless && current_user" @valid="name_valid" />
    <mobile-as-form
      v-else-if="!nameless || !current_user"
      @signed-on="signed_on"
      @working="working = $event" />
    <footer v-if="cleanable">
      <button @click="clean">Wipe</button>
    </footer>
  </section>
</template>

<style lang="stylus">
  section#sign-on.page {
    & > header
      display: block
      padding: 0
      margin-bottom: base-line
    & > form {
      width: 100%;
    }
    & > footer > button {
      margin: base-line;
      opacity: 0.66;
      font-size: 0.66em;
      padding: (base-line * 0.125) (base-line * 0.25);
      line-height: 1.1;
      border: none;
      transition-property: opacity, border;
      transition-duration: 0.33s;
      transition-timing-function: ease;
      &:hover {
        opacity: 1;
        border: 2px solid red;
      }
    }
    @media (min-width: page-width-large) {
      margin: autocomplete
    }
  }
</style>
