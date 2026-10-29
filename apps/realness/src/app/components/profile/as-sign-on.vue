<script setup>
  import MobileAsForm from '@/components/profile/as-form-mobile'
  import NameAsForm from '@/components/profile/as-form-name'
  import { use_sign_on } from 'realness/sign-on/flow'
  import { use_sign_on_profile } from '@/use/sign-on-profile'
  import { current_user } from '@/utils/serverless'
  import { ref } from 'vue'

  const emit = defineEmits(['signed_in', 'showing_mobile'])

  defineOptions({
    name: 'AsSignOn'
  })

  const working = ref(false)
  const profile = use_sign_on_profile()
  const { loaded } = profile
  const { nameless, pending, on_signed_on, on_name_valid } = use_sign_on({
    current_user,
    profile,
    emit
  })
</script>

<template>
  <section id="sign-on">
    <p v-if="pending" id="sign-on-pending" role="status">
      Checking your profile...
    </p>
    <template v-else-if="nameless && current_user">
      <p id="name-prompt">What should we call you?</p>
      <name-as-form @valid="on_name_valid" />
    </template>
    <mobile-as-form
      v-else-if="!current_user"
      @signed-on="on_signed_on"
      @working="working = $event" />
    <p v-else id="sign-on-pending" role="status">Signing you in...</p>
  </section>
</template>

<style>
  section#sign-on {
    min-width: min(calc(var(--base-line) * 18), 100%);

    & > form {
      width: 100%;
    }
  }
</style>
