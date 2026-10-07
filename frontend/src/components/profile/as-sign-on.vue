<script setup>
  import MobileAsForm from '@/components/profile/as-form-mobile'
  import NameAsForm from '@/components/profile/as-form-name'
  import { use_sign_on } from 'brayness/sign-on/flow'
  import { use_sign_on_profile } from '@/use/sign-on-profile'
  import { current_user } from '@/utils/serverless'
  import { ref } from 'vue'

  const emit = defineEmits(['signed_in', 'showing_mobile'])

  defineOptions({
    name: 'AsSignOn'
  })

  const working = ref(false)
  const { nameless, on_signed_on, on_name_valid } = use_sign_on({
    current_user,
    profile: use_sign_on_profile(),
    emit
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

<style>
  section#sign-on {
    /* The form drives the width rather than inheriting the reset's
       page-width max and sitting off to one side. */
    min-width: min(calc(var(--base-line) * 18), 100%);

    & > form {
      width: 100%;
    }
  }
</style>
