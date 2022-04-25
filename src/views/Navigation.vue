<template>
  <section id="navigation" class="page" :class="{ posting }">
    <nav ref="nav">
      <router-link v-if="!posting" to="/account" class="black" tabindex="-1">
        {{ first_name }}
      </router-link>
      <router-link v-if="!posting" to="/events" class="green" tabindex="-1">
        Events
      </router-link>
      <router-link v-if="!posting" to="/posters" class="green" tabindex="-1">
        Posters
      </router-link>
      <router-link v-if="!posting" to="/feed" class="blue" tabindex="-1">
        Feed
      </router-link>
      <router-link v-if="!posting" to="/phonebook" class="blue" tabindex="-1">
        Relations
      </router-link>
      <button v-if="posting" tabindex="-1" @click="done_posting">Done</button>
      <statement-as-textarea
        class="red"
        @toggle-keyboard="posting = !posting"
        @update:statement="emit('update:statement', $event)" />
    </nav>
    <footer>
      <h6>{{ version }}</h6>
      <router-link to="/about" tabindex="-1"> ? </router-link>
    </footer>
  </section>
</template>
<script setup>
  import StatementAsTextarea from '@/components/statements/as-textarea'
  import { load } from '@/use/itemid'
  import { ref, onMounted as mounted } from 'vue'
  const version = import.meta.env.PACKAGE_VERSION
  const emit = defineEmits(['update:person', 'update:statement'])
  const posting = ref(false)
  const first_name = ref('')
  const nav = ref()
  const done_posting = () => nav.value.focus()
  mounted(async () => {
    let my = await load(localStorage.me)
    if (my && my.first_name) first_name.value = my.first_name
    else first_name.value = 'You'
    console.info('views:Navigation')
  })
</script>
<style lang="stylus">
  section#navigation.page
    display: flex
    align-items: center
    max-width: page-width
    &.posting
      margin-top: inset(top)
      height: inherit
      @media (max-width: pad-begins)
        align-items: flex-start
      & > nav
        transition-duration: 0.5s
        min-height: round(base-line * 10)
        height: round(base-line * 10)
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
      min-height: round(base-line * 19, 2)
      max-height: page-width
      height: 100vmin
      width: 100vw
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
        &:nth-child(even)
         text-align: right
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
      padding: 0
      & > h6
      & > a
        margin: 0
        padding: 0
        position: fixed
        bottom: base-line
      & > h6
        left: base-line
      & > a
        color: white
        right: base-line
</style>
