<script setup>
  import { onMounted as mounted } from 'vue'
  import { me } from '@/utils/serverless'

  defineOptions({ name: 'SponsorCta' })

  const buy_button_id = import.meta.env.VITE_STRIPE_BUY_BUTTON_ID
  const publishable_key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  const can_render_button = !!(buy_button_id && publishable_key)

  // Lazy: fetch buy-button.js only when this component mounts and only once.
  // Wait for idle so it never competes with app boot.
  const load_stripe_buy_button = () => {
    if (document.querySelector('script[data-stripe-buy-button]')) return
    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/buy-button.js'
    script.async = true
    script.dataset.stripeBuyButton = 'true'
    document.head.appendChild(script)
  }

  mounted(() => {
    if (!can_render_button) return
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1))
    idle(load_stripe_buy_button)
  })
</script>

<template>
  <stripe-buy-button
    v-if="can_render_button"
    :buy-button-id="buy_button_id"
    :publishable-key="publishable_key"
    :client-reference-id="me?.id || undefined" />
  <span v-else class="missing-link">
    Set VITE_STRIPE_BUY_BUTTON_ID and VITE_STRIPE_PUBLISHABLE_KEY to enable.
  </span>
</template>

<style lang="stylus">
  stripe-buy-button
    display: inline-block
  span.missing-link
    font-size: 0.75em
    color: red
</style>
