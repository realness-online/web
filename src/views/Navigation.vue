<script setup>
  import Icon from '@/components/icon'
  import StatementAsTextarea from '@/components/statements/as-textarea'
  import { ref, onMounted as mounted } from 'vue'
  import { use as use_vectorize } from '@/use/vectorize'
  import AccountDialog from '@/components/profile/as-dialog-account'
  const version = import.meta.env.PACKAGE_VERSION

  const posting = ref(false)
  const nav = ref()

  const toggle_keyboard = () => {
    posting.value = !posting.value
  }

  const { vVectorizer, image_picker, open_camera, mount_workers } =
    use_vectorize()

  mounted(() => mount_workers())
</script>

<template>
  <section id="navigation" class="page" :class="{ posting }">
    <header>
      <account-dialog />
    </header>
    <nav ref="nav">
      <router-link v-if="!posting" to="/statements" class="black" tabindex="-1">
        Statements
      </router-link>
      <router-link v-if="!posting" to="/events" class="green" tabindex="-1">
        Events
      </router-link>
      <router-link v-if="!posting" to="/posters" class="green" tabindex="-1">
        Posters
      </router-link>
      <router-link v-if="!posting" to="/phonebook" class="blue" tabindex="-1">
        Phonebook
      </router-link>
      <router-link v-if="!posting" to="/thoughts" class="blue" tabindex="-1">
        Thoughts
      </router-link>
      <statement-as-textarea class="red" @toggle-keyboard="toggle_keyboard" />
    </nav>
    <footer v-if="!posting">
      <router-link :to="`/docs#${version}`" tabindex="-1">{{
        version
      }}</router-link>
      <a id="camera" @click="open_camera">
        <icon name="camera" />
      </a>
      <router-link to="/about" tabindex="-1">?</router-link>
    </footer>
  </section>
  <aside>
    <input
      ref="image_picker"
      v-vectorizer
      type="file"
      accept="image/jpeg,image/png" />
  </aside>
</template>

<style lang="stylus">
  section#navigation.page
    display: flex
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
      opacity: 0.66;
      position: fixed;
      bottom: 0;
      left: 0;
      @media (min-width: pad-begins) {
        top: env(safe-area-inset-top) !important;
      }
      &:hover, &:active {
        opacity: 1;
      }
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
      & > a {
        @media (prefers-color-scheme: light) {
          color: #fff;
        }
      }
    }
    & > footer {
      display: flex;
      justify-content: space-between;
      width: 100%;
      align-items: center;
      padding: 0 base-line;
      & > a {
        margin: 0;
        padding: 0;
      }
      #camera {
        border-radius: base-line;

        position: fixed;
        bottom: base-line * 2;
        right: s('calc( 50% - %s)', (3.3325rem * 0.5));
        z-index: 4;
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
</style>
