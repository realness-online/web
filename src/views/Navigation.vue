<script setup>
  import Icon from '@/components/icon'
  import StatementAsTextarea from '@/components/statements/as-textarea'
  import { inject } from 'vue'
  import AccountDialog from '@/components/profile/as-dialog-account'
  import { posting } from '@/use/posting'

  const open_camera = inject('open_camera')
  const toggle_keyboard = () => {
    posting.value = !posting.value
  }
</script>

<template>
  <section id="navigation" class="page" :class="{ posting }">
    <header>
      <account-dialog v-if="!posting" />
      <router-link v-if="!posting" id="about" to="/about" tabindex="-1"
        >?</router-link
      >
    </header>
    <nav>
      <router-link v-if="!posting" to="/thoughts" class="black" tabindex="-1">
        Thoughts
      </router-link>
      <router-link v-if="!posting" to="/phonebook" class="green" tabindex="-1">
        Phonebook
      </router-link>
      <router-link v-if="!posting" to="/posters" class="green" tabindex="-1">
        Posters
      </router-link>
      <router-link v-if="!posting" to="/events" class="sediment" tabindex="-1">
        Events
      </router-link>
      <router-link
        v-if="!posting"
        to="/statements"
        class="sediment"
        tabindex="-1">
        Statements
      </router-link>
      <statement-as-textarea @toggle-keyboard="toggle_keyboard" />
    </nav>
    <footer v-if="!posting">
      <a
        id="camera"
        tabindex="3"
        @click="open_camera"
        @keydown.enter="open_camera">
        <icon name="camera" />
      </a>
    </footer>
  </section>
</template>

<style lang="stylus">

  section#navigation.page {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    min-height: 100dvh;
    overflow: hidden;
    overscroll-behavior: none;
    touch-action: none;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    max-width: page-width;
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
        top: inset(top,  base-line);
        right: base-line;
        font-weight:bold;
        font-size: base-line * 1.44;
        padding: base-line * 0.5;
        -webkit-user-select: none;
        user-select: none;
      }
    }
    &:focus-within > header > a#toggle-account {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    &.posting {
      align-self: start;
      margin-top: inset(top);
      height: inherit;
      @media (max-width: pad-begins) {
        align-items: flex-start;
      }
      & > footer {
        height: 50dvh;
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
        &::placeholder {
          @media (prefers-color-scheme: light) {
            color: #fff;
          }
        }
      }
      & > textarea {
        -webkit-user-select: text;
        user-select: text;
      }
      & > a {
        @media (prefers-color-scheme: light) {
          color: #fff;
        }
      }
    }
    & > footer {
      padding: 0;
      & > a {
        margin: 0;
        padding: 0;
      }
      #camera {
        border-radius: base-line;
        padding: base-line * 0.5;
        position: fixed;
        bottom: base-line;
        right: s('calc( 50% - %s)', (base-line * 1.5));
        z-index: 4;
        &:focus {
          outline: 2px solid yellow
        }
        svg {
          fill: red;
        }
      }
      & > a:first-of-type {
        color: blue;
        padding: 0;
        margin: 0;
        border: none;
        font-size: 0.66em;
      }
      & > a {
        color: blue;
        right: base-line;
      }
      & > menu {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }
  }
</style>
