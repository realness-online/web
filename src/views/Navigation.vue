<script setup>
  import Icon from '@/components/icon'
  import StatementAsTextarea from '@/components/statements/as-textarea'
  import { ref, onMounted as mounted, inject, nextTick as next_tick } from 'vue'
  import { use as use_vectorize } from '@/use/vectorize'
  import AccountDialog from '@/components/profile/as-dialog-account'
  const version = import.meta.env.PACKAGE_VERSION

  const show_utility_components = inject('show_utility_components')
  const posting = ref(false)
  const nav = ref()

  const toggle_keyboard = async () => {
    posting.value = !posting.value
    if (show_utility_components) show_utility_components.value = !posting.value

    if (posting.value) {
      await next_tick()
      document
        .querySelector('textarea#wat')
        .scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const done_posting = () => {
    document.querySelector('textarea#wat').blur()
    posting.value = false
    if (show_utility_components) show_utility_components.value = true
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
      <button v-if="posting" @click="done_posting">Done</button>
    </nav>
    <footer v-if="!posting">
      <button>{{ version }}</button>
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
    align-items: center
    flex-direction: column
    justify-content: center
    max-width: page-width
    @media (max-width: pad-begins) and (orientation: portrait)
      padding: 0 base-line
    @media (max-height: pad-begins) and (orientation: landscape)
      height: auto
      max-width: none
    a#toggle-name
      position: fixed
      top: inset(top,  base-line )
      left: base-line
    & > header
      opacity: 0.66
      position: fixed
      bottom: 0
      left: 0
      @media (min-width: pad-begins)
        top: env(safe-area-inset-top) !important
      &:hover, &:active
        opacity: 1
    &.posting
      align-self: start
      margin-top: inset(top)
      height: inherit
      @media (max-width: pad-begins)
        align-items: flex-start
      & > footer
        height: 50dvh
      & > nav
        width: 100%
        transition-duration: 0.5s
        min-height: inherit
        & > button
          width: base-line * 3
          height: base-line * 1.66
          line-height: 0
          padding: 0
          display: block
    & > nav
      transition-duration: 0s
      display: grid
      grid-gap: base-line
      grid-template-columns: 1fr 1fr
      align-items: stretch
      min-height: round(base-line * 18, 2)
      max-height: page-width
      min-width: 33dvw
      margin-bottom: base-line * 2
      margin-top: base-line * 2
      @media (orientation: landscape) and (display-mode: standalone) and (max-height: pad-begins)
        display:none
      @media (max-height: pad-begins) and (orientation: landscape)
        min-height: auto
        padding: base-line (base-line * 4)
      & > a
        text-transform: capitalize
        text-align: left
        border-width: 1px
        border-style: solid
        &:focus
          color: transparent
          transition-duration: 0.6s
          transition: all
          outline: none
        &:nth-child(odd)
         text-align: left
        &:active
          border-width: 1vmax
          color:transparent
      & > a
      & > textarea
        padding: base-line
        border-radius: base-line
        text-align: right
        &::placeholder
          @media (prefers-color-scheme: light)
            color: #fff
      & > a
        @media (prefers-color-scheme: light)
          color: #fff
    & > footer
      display: flex
      justify-content: space-between
      align-items: center
      min-width: 33dvw
      padding: 0
      & > button
      & > a
      & > textarea
        margin: 0
        padding: 0
        bottom: base-line
      &#camera
        border-radius: base-line
        padding: base-line * 0.5
        position: fixed
        bottom: base-line
        right: s('calc( 50% - %s)', (base-line * 1.75) )
        z-index: 4
        @media (min-width: pad-begins)
          position:inherit
        svg
          fill: red
      & > button
        left: base-line
        border: none
        font-size: 0.66em
      & > a
        color: yellow
        right: base-line
      & > menu
        display: flex
        align-items: center
        justify-content: space-between
</style>
