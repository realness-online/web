<script setup>
  import { ref, watch, onMounted as mounted } from 'vue'
  import { use_me } from '@/use/people'
  const props = defineProps({
    person: {
      type: Object,
      required: true
    },
    editable: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const { me } = use_me()
  const person = ref(props.person)
  mounted(() => {
    if (me.value.id === person.value.id) person.value = me.value
  })
  watch(me, () => (person.value = me.value))
</script>

<template>
  <address itemscope itemtype="/person" :itemid="person.id">
    <h3 itemprop="first_name">{{ person.first_name }}</h3>
    <h3 itemprop="last_name">{{ person.last_name }}</h3>
    <slot />
    <link
      v-if="person.avatar"
      :key="person.avatar"
      itemprop="avatar"
      rel="icon"
      :href="person.avatar" />
    <meta v-if="person.visited" itemprop="visited" :content="person.visited" />
  </address>
</template>

<style lang="stylus">
  address[itemscope]
    color: black
    margin: 0
    padding: 0
    @media (prefers-color-scheme: dark)
      color: white
    & > h3,
    & > b
      text-align: left
    & > h3
      between font-size
      margin: 0
      text-transform: capitalize
      &:first-of-type
        margin-bottom: round((base-line / 6), 2)
    & > b[itemprop]
      line-height: 1
      display: inline-block
      font-weight: 300
      &:first-of-type
        margin-right: round((base-line / 6), 2)
        margin-bottom: round((base-line / 3), 2)
      &:focus
        font-weight: 400
        outline: 0
</style>
