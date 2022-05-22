<template>
  <address itemscope itemtype="/person" :itemid="person.id">
    <b
      v-if="editable"
      ref="first_name"
      :key="me.first_name"
      :contenteditable="true"
      itemprop="first_name"
      @blur="save_first_name">
      {{ person.first_name }}
    </b>
    <h3 v-else itemprop="first_name">{{ person.first_name }}</h3>
    <b
      v-if="editable"
      ref="last_name"
      :key="person.last_name"
      :contenteditable="true"
      itemprop="last_name"
      @blur="save_last_name">
      {{ person.last_name }}
    </b>
    <h3 v-else itemprop="last_name">{{ person.last_name }}</h3>
    <slot />
    <link
      v-if="person.avatar"
      :key="person.avatar"
      itemprop="avatar"
      rel="icon"
      :href="person.avatar" />
    <meta v-if="person.mobile" itemprop="mobile" :content="person.mobile" />
    <meta v-if="person.visited" itemprop="visited" :content="person.visited" />
  </address>
</template>

<script setup>
  import { ref } from 'vue'
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
  const { me, save } = use_me()
  const person = ref(props.person)
  if (me.id === person.id) person.value = me.value
  const last_name = ref(null)
  const first_name = ref(null)
  const save_first_name = () => {
    const changed = first_name.value.textContent.trim()
    if (props.person.first_name !== changed) {
      me.value.first_name = changed
      save()
    }
  }
  const save_last_name = () => {
    const changed = last_name.value.textContent.trim()
    if (props.person.last_name !== changed) {
      me.value.last_name = changed
      save()
    }
  }
</script>
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
