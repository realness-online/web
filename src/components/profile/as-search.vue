<script setup>
  import icon from '@/components/icon'
  import { ref } from 'vue'

  defineOptions({
    name: 'ProfileSearch'
  })

  const searching = ref(false)
  const query = ref('')

  const search_mode = () => {
    searching.value = true
  }

  const view_friends_mode = () => {
    query.value = ''
    searching.value = false
  }
</script>

<template>
  <label for="search">
    <input
      id="search"
      v-model="query"
      type="search"
      placeholder="Search phonebook"
      autocomplete="off"
      @focusout="view_friends_mode"
      @focusin="search_mode" />
    <icon name="search" />
  </label>
</template>

<style lang="stylus">
  label[for=search]
    position: relative
    & > *
      fill: blue
      height: base-line * 2
      width: base-line * 2
    svg
      position: absolute
      top: 0
      left: 0
      z-index: -2
    input#search
      standard-border: blue
      border-width: 0
      position: relative
      z-index: 2
      transition-delay: 0.15s
      transition-property: all
      &::placeholder
        color: transparent
      &:focus
        transition-delay: 0.15s
        standard-border: blue
        padding: round((base-line / 2 ), 2)
        width: inherit
        &::placeholder
          color:blue
          transition-duration: 0.75
          transition-property: all
          transition-delay: 0.25s
      &:focus ~ svg
        transition-property: all
        height:0
        width:0
</style>
