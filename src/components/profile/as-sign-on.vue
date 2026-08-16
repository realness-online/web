<script setup>
  import MobileAsForm from '@/components/profile/as-form-mobile'
  import NameAsForm from '@/components/profile/as-form-name'
  import { load, load_from_network } from '@/utils/itemid'
  import { use_me } from '@/use/people'
  import { current_user } from '@/utils/serverless'
  import { ref, watchEffect as watch_effect } from 'vue'

  const emit = defineEmits(['signed_in', 'showing_mobile'])

  defineOptions({
    name: 'AsSignOn'
  })

  const { is_valid_name, save } = use_me()
  const nameless = ref(false)
  const working = ref(false)

  const on_signed_on = async () => {
    const network_profile = await load_from_network(localStorage.me)
    const local_profile = await load(localStorage.me)

    const my_profile = network_profile || local_profile
    if (my_profile) {
      const valid = is_valid_name.value
      if (valid) emit('signed_in')
      else nameless.value = true
    } else nameless.value = true
  }

  const on_name_valid = async () => {
    await save()
    emit('signed_in')
  }

  watch_effect(() => {
    const valid = is_valid_name.value
    if (current_user.value && !valid) nameless.value = true
  })

  watch_effect(() => {
    emit('showing_mobile', !nameless.value)
  })
</script>

<template>
  <section id="sign-on">
    <template v-if="nameless && current_user">
      <p id="name-prompt">What should we call you?</p>
      <name-as-form @valid="on_name_valid" />
    </template>
    <mobile-as-form
      v-else-if="!nameless || !current_user"
      @signed-on="on_signed_on"
      @working="working = $event" />
  </section>
</template>

<style lang="stylus">
  section#sign-on {
    & > form {
      width: 100%;
    }

    // Phones give the form the whole column already. From tablets up the
    // reset's `form { max-width: page-width }` leaves it pinned to the left
    // edge under the settings, so center it and let it own the leftover
    // page height.
    @media (min-width: pad-begins) {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 60svh;

      & > form {
        margin-inline: auto;
      }

      & > p#name-prompt {
        margin-inline: auto;
        text-align: center;
      }
    }
  }
</style>
