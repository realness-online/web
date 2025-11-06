<script setup>
  import MobileAsForm from '@/components/profile/as-form-mobile'
  import NameAsForm from '@/components/profile/as-form-name'
  import { load } from '@/utils/itemid'
  import { use_me } from '@/use/people'
  import { current_user } from '@/utils/serverless'
  import { keys, clear } from 'idb-keyval'
  import { ref, computed, watchEffect as watch_effect } from 'vue'

  const emit = defineEmits(['signed_in', 'showing_mobile'])

  defineOptions({
    name: 'AsSignOn'
  })

  const { is_valid_name } = use_me()
  const nameless = ref(false)
  const index_db_keys = ref([])
  const cleanable = computed(() => {
    if (current_user.value) return false
    if (localStorage.me && localStorage.me.length > 2) return true
    if (localStorage.length > 2) return true
    if (index_db_keys.value.length > 1) return true
    return false
  })

  const signed_on = async () => {
    const my_profile = await load(localStorage.me)
    if (my_profile) emit('signed_in')
    else nameless.value = true
  }

  const new_person = () => {
    // Defer routing decisions to parent context if needed
    // For now, reveal the name form inline
    nameless.value = true
  }

  const clean = async () => {
    for (const key in localStorage)
      if (Object.prototype.hasOwnProperty.call(localStorage, key))
        localStorage.removeItem(key)
    localStorage.me = '/+'
    await clear()
    window.location.href = '/'
  }

  watch_effect(async () => {
    const valid = await is_valid_name.value
    if (current_user.value && !valid) nameless.value = true
  })

  // Inform parent whether the mobile form is currently shown
  watch_effect(() => {
    emit('showing_mobile', !nameless.value)
  })

  watch_effect(async () => {
    index_db_keys.value = await keys()
  })
</script>

<template>
  <section id="sign-on">
    <name-as-form v-if="nameless" @valid="new_person" />
    <mobile-as-form v-else @signed-on="signed_on" />
    <footer v-if="cleanable">
      <button @click="clean">Wipe</button>
    </footer>
  </section>
</template>

<style lang="stylus">
  section#sign-on {
    padding: 0;
    & > form {
      width: 100%;
    }
    & > footer > button {
      opacity: 0.5;
      font-size: 0.5em;
      padding: (base-line * 0.125) (base-line * 0.25);
      line-height: 1.1;
      border: none
      transition-property: opacity, border;
      transition-duration: 0.33s;
      transition-timing-function: ease;
      &:hover {
        opacity: 1
        border: 2px solid red
      }
    }

  }
</style>
