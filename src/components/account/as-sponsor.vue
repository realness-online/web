<script setup>
  import { computed } from 'vue'
  import { use_sponsor } from '@/use/sponsor'
  import SponsorCta from '@/components/sponsor/cta'

  defineOptions({ name: 'AsSponsor' })

  const { is_sponsor, latest_sponsorship } = use_sponsor()

  const formatted_at = computed(() => {
    const at = latest_sponsorship.value?.at
    if (!at) return ''
    try {
      return new Date(at).toLocaleDateString()
    } catch {
      return at
    }
  })
</script>

<template>
  <section class="as-sponsor">
    <h4>Sponsor</h4>
    <p v-if="is_sponsor">
      Thank you
      <time :datetime="latest_sponsorship?.at">{{ formatted_at }}</time
      >.
    </p>
    <p v-else>Realness is free to use. It costs $5.</p>
    <menu>
      <sponsor-cta />
    </menu>
  </section>
</template>

<style lang="stylus">
  section.as-sponsor
    padding: base-line 0
    border-top: 1px solid blue
    margin-top: base-line * 2
    & > h4
      margin: (base-line * 0.33)
      color: blue
    & > p
      margin: (base-line * 0.5)
      margin-bottom: base-line *2
      & > time
        color: blue
    & > menu
      display: flex
      justify-content: center
      margin: 0
      padding: 0
</style>
