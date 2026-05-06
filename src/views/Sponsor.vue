<script setup>
  import LogoAsLink from '@/components/logo-as-link'
  import SponsorCta from '@/components/sponsor/cta'

  defineOptions({ name: 'Sponsor' })
</script>

<template>
  <section id="sponsor-page" class="page">
    <header>
      <logo-as-link />
    </header>
    <article>
      <h1>Sponsor</h1>
      <p>Realness is independent. If it earns its place, kick in any amount.</p>
      <p class="fine-print">
        You can sponsor signed in or signed out. Signed-in sponsorships show up
        on your account.
      </p>
      <menu>
        <sponsor-cta />
      </menu>
    </article>
  </section>
</template>

<style lang="stylus">
  section#sponsor-page.page
    padding: base-line
    max-width: page-width
    margin: 0 auto
    & > header
      display: flex
      justify-content: space-between
      align-items: center
      margin-bottom: base-line
    & > article
      & > h1
        margin: 0 0 (base-line * 0.5)
        color: blue
      & > p
        margin: 0 0 (base-line * 0.5)
      & > p.fine-print
        font-size: 0.85em
        opacity: 0.75
      & > menu
        display: flex
        justify-content: center
        margin: base-line 0 0
        padding: 0
    @media (min-width: page-width-large)
      max-width: page-width-large
</style>
