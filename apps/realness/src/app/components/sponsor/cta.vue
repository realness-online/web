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
    if (me.value?.id) url.searchParams.set('client_reference_id', me.value.id)
    return url.toString()
  })

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
    // eslint-disable-next-line compat/compat -- guarded by || setTimeout
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1))
    idle(load_stripe_buy_button)
  })
</script>

<template>
  <a v-if="checkout_url" data-checkout :href="checkout_href" rel="external">
    Subscribe
  </a>
  <stripe-buy-button
    v-else-if="can_render_button"
    :buy-button-id="buy_button_id"
    :publishable-key="publishable_key"
    :client-reference-id="me?.id || undefined" />
</template>

<style>
  stripe-buy-button {
    display: inline-block;
    min-height: 223px;
    min-width: 160px;
  }
  a[data-checkout] {
    display: inline-block;
    padding: var(--base-line);
    border: calc(var(--base-line) * 0.1) solid var(--accent);
    border-radius: calc(var(--base-line) * 0.33);
    color: var(--accent);
    font-weight: bold;
    text-decoration: none;
    &:hover,
    &:focus-visible {
      background-color: color-mix(in srgb, var(--accent) 12%, transparent);
    }
  }
</style>
