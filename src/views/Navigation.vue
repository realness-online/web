<script setup>
  import Icon from '@/components/icon'
  import StatementAsTextarea from '@/components/statements/as-textarea'
  import { load } from '@/utils/itemid'
  import { ref, onMounted as mounted } from 'vue'
  import { use as use_vectorize } from '@/use/vectorize'
  const version = import.meta.env.PACKAGE_VERSION
  const posting = ref(false)
  const first_name = ref('')
  const nav = ref()
  const done_posting = () => nav.value.focus()
  const { vVectorizer, image_picker, open_camera, mount_workers } =
    use_vectorize()
  mounted(async () => {
    const my = await load(localStorage.me)
    if (my?.first_name) first_name.value = my.first_name
    else first_name.value = 'You'
    console.info('views:Navigation')
    mount_workers()
  })
</script>

<template>
  <section id="navigation" class="page" :class="{ posting }">
    <header>
      <router-link id="settings" to="/settings" tabindex="-1">
        <icon name="gear" /> <span>{{ first_name }}</span>
      </router-link>
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
      <button v-if="posting" tabindex="-1" @click="done_posting">Done</button>
      <statement-as-textarea
        class="red"
        @toggle-keyboard="posting = !posting" />
    </nav>
    <footer>
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
    & > header
      opacity: 0.66
      position: fixed
      top: base-line * 1.5
      left: 0
      @media (min-width: pad-begins)
        top: env(safe-area-inset-top) !important
      &:hover, &:active
        opacity: 1
      & > a
        display: flex
        align-items: center
        & > svg
          display: inline-block
          fill: red
        & > span
          margin-left: base-line * .5
          line-height: 0
          display: inline-block
          vertical-align: middle
    &.posting
      align-self: end
      margin-top: inset(top)
      height: inherit
      @media (max-width: pad-begins)
        align-items: flex-start
      & > footer
        height: 50vh
      & > nav
        transition-duration: 0.5s
        min-height: round(base-line * 10)
        height: round(base-line * 15)
        & > button
          top: 0
          width: base-line * 3
          height: base-line * 1.66
          line-height: 0
          padding: 0
          display: block
    @media (max-width: pad-begins) and (orientation: portrait)
      padding: 0 base-line
    @media (max-height: pad-begins) and (orientation: landscape)
      height: auto
      max-width: none
    & > nav
      transition-duration: 0s
      display: grid
      grid-gap: base-line
      grid-template-columns: 1fr 1fr
      align-items: stretch
      min-height: round(base-line * 18, 2)
      max-height: page-width
      min-width: 33vw
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

      min-width: 33vw
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
