<script setup>
  import { computed, onMounted as mounted } from 'vue'
  import { me } from '@/utils/serverless'

  defineOptions({ name: 'SponsorCta' })

  const props = defineProps({
    buy_button_id: {
      type: String,
      default: 'buy_btn_0TTXvPANizuvdTZsWfCGhEHG'
    },
    publishable_key: {
      type: String,
      default: 'pk_live_OGXHSdpX4i3CQ7w30os4sseX'
    },
    checkout_url: {
      type: String,
      default: ''
    }
  })

  const can_render_button = computed(
    () =>
      !props.checkout_url && !!(props.buy_button_id && props.publishable_key)
  )

  const checkout_href = computed(() => {
    if (!props.checkout_url) return ''
    const url = new URL(props.checkout_url)
    // `me` is a ref — auto-unwrapped in the template, but not here in <script>.
    if (me.value?.id) url.searchParams.set('client_reference_id', me.value.id)
    return url.toString()
  })

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
    if (!can_render_button.value) return
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1))
    idle(load_stripe_buy_button)
  })
</script>

<template>
  <a v-if="checkout_url" class="checkout" :href="checkout_href" rel="external">
    Subscribe
  </a>
  <stripe-buy-button
    v-else-if="can_render_button"
    :buy-button-id="buy_button_id"
    :publishable-key="publishable_key"
    :client-reference-id="me?.id || undefined" />
</template>

<style lang="stylus">
  stripe-buy-button
    display: inline-block
  a.checkout
    display: inline-block
    padding: base-line * 0.5 base-line
    border: round((base-line * 0.1), 2) solid var(--accent)
    border-radius: base-line * 0.33
    color: accent
    font-weight: bold
    text-decoration: none

    &:hover,
    &:focus-visible
      background-color: alpha(water-fill, 0.12)
</style>
