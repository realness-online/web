<script setup>
  import AsSignOn from '@/components/profile/as-sign-on'
  import { after_sign_on } from '@/utils/after-sign-on'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'

  /* Sign-on is a page, never a dialog. The URL is the state, so every way of
     arriving shows the form, and Google's reCAPTCHA challenge has nothing to
     hide behind. */
  defineOptions({ name: 'SignOn' })

  const route = use_route()
  const router = use_router()

  const on_signed_in = () => router.replace(after_sign_on(route.query))
</script>

<template>
  <section id="signing-on" data-page>
    <as-sign-on @signed_in="on_signed_in" />
  </section>
</template>

<style>
  section#signing-on[data-page] {
    display: grid;
    place-items: center;
    min-height: calc(100svh - var(--base-line) * 10);
    padding-inline: var(--base-line);

    & > section#sign-on {
      width: min(calc(var(--base-line) * 22), 100%);
    }
  }
</style>
