<script setup>
  import { posting } from '@/use/posting'

  const version = import.meta.env.PACKAGE_VERSION
  const version_parts = version.split('.')
</script>

<template>
  <section id="navigation" class="page" :class="{ posting }">
    <header>
      <router-link v-if="!posting" id="about" to="/about" tabindex="-1">
        <span>{{ version_parts[0] }}</span>
        <span>?</span>
        <span>{{ version_parts[1] }}</span>
        <span>{{ version_parts[2] }}</span>
      </router-link>
    </header>
    <nav hidden>
      <router-link v-if="!posting" to="/phonebook" class="green" tabindex="-1">
        Phonebook
      </router-link>
      <router-link v-if="!posting" to="/posters" class="green" tabindex="-1">
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
    & > header {
      padding: 0;
      :fullscreen & {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
      @media (min-width: pad-begins) {
        top: env(safe-area-inset-top) !important;
      }
      &:hover, &:active {
        opacity: 1;
      }
      & > a#about {
        position: fixed;
        top: env(safe-area-inset-top);
        right: base-line;
        font-weight: bold;
        font-size: base-line * 1.44;

        -webkit-user-select: none;
        user-select: none;
        display: grid;
        grid-template-columns: auto auto auto;
        grid-template-rows: auto auto;
        align-items: baseline;
        & > span {
          font-size: 0.266em;
          vertical-align: sub;
          opacity: 0.67;
        }
        & > span:first-child {
          grid-column: 1;
          grid-row: 1;
          margin-right: 0.1em;
          margin-left: -(base-line * 0.25);
        }
        & > span:nth-child(2) {
          grid-column: 2;
          grid-row: 1;
          font-size: 1em;
          opacity: 1;
        }
        & > span:nth-child(3) {
          grid-column: 2;
          grid-row: 2;
          justify-self: center;
          transform: translateY(-(base-line * 0.25));
        }
        & > span:last-child {
          grid-column: 3;
          grid-row: 1;
          margin-left: 0.1em;
          margin-right: -(base-line * 0.25);
        }
      }
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
