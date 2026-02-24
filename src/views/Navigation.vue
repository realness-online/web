<script setup>
  import { posting } from '@/use/posting'
</script>

<template>
  <section id="navigation" class="page" :class="{ posting }">
    <nav hidden>
      <router-link v-if="!posting" to="/phonebook" class="blue" tabindex="-1">
        Phonebook
      </router-link>
      <router-link v-if="!posting" to="/posters" class="blue" tabindex="-1">
        Posters
      </router-link>
      <router-link v-if="!posting" to="/events" class="sediment" tabindex="-1">
        Events
      </router-link>
      <router-link v-if="!posting" to="/" class="sediment" tabindex="-1">
        Thoughts
      </router-link>
    </nav>
  </section>
</template>

<style lang="stylus">

  section#navigation.page {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    min-height: 100dvh;
    background: linear-gradient(
      to bottom,
      var(--sediment) 0%,
      var(--sand) 25%,
      var(--gravel) 50%,
      var(--rocks) 75%,
      var(--boulders) 100%
    );

    overscroll-behavior: none;
    touch-action: none;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;

    @media (max-width: pad-begins) and (orientation: portrait) {
      padding: 0 base-line;
    }
    @media (max-height: pad-begins) and (orientation: landscape) {
      height: auto;
      max-width: none;
    }
    &.posting {
      align-self: start;
      margin-top: safe_inset(top);
      height: inherit;
      @media (max-width: pad-begins) {
        align-items: flex-start;
      }
      & > nav {
        width: 100%;
        transition-duration: 0.5s;
        min-height: inherit;
      }
    }
    & > nav {
      transition-duration: 0s;
      display: grid;
      grid-gap: base-line;
      grid-template-columns: 1fr 1fr;
      align-items: stretch;
      min-height: round(base-line * 18, 2);
      max-height: page-width;
      min-width: 40dvw;
      width: 100%;
      margin-bottom: base-line * 2;
      margin-top: base-line * 2;
      @media (orientation: landscape) and (display-mode: standalone) and (max-height: pad-begins) {
        display: none;
      }
      @media (max-height: pad-begins) and (orientation: landscape) {
        min-height: auto;
        padding: base-line (base-line * 4);
      }
      & > a {
        text-transform: capitalize;
        text-align: left;
        border-width: 1px;
        border-style: solid;
        &:focus {
          color: transparent;
          transition-duration: 0.6s;
          transition: all;
          outline: none;
        }
        &:nth-child(odd) {
          text-align: left;
        }
        &:active {
          border-width: 1vmax;
          color: transparent;
        }
      }
      & > a, & > textarea {
        padding: base-line;
        border-radius: base-line;
        text-align: right;
      }
      & > textarea {
        -webkit-user-select: text;
        user-select: text;
      }
    }
  }
</style>
