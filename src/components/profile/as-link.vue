<script setup>
  import icon from '@/components/Icon'
  import { load, as_author } from '@/utils/itemid'
  import AsAvatar from '@/components/posters/as-svg'
  import AsAddress from '@/components/profile/as-address'
  import { ref, computed, onMounted } from 'vue'

  const props = defineProps({
    itemid: {
      type: String,
      required: true
    }
  })

  defineOptions({
    name: 'ProfileLink'
  })

  const person = ref(null)

  const author = computed(() => as_author(props.itemid))

  onMounted(async () => {
    if (!author.value) return
    person.value = await load(author.value)
  })
</script>

<template>
  <router-link v-if="person" :to="author" class="profile">
    <as-avatar v-if="person.avatar" :itemid="person.avatar" />
    <icon v-else name="silhouette" />
    <as-address :person="person">
      <slot />
    </as-address>
  </router-link>
</template>

<style lang="stylus">
  a.profile
    display: inline-flex
    shape-outside: circle()
    margin-right: round((base-line / 3), 2)
    & > svg
      shape-outside: circle()
      fill: black-dark
      width: base-line * 2
      height: base-line * 2
      min-height: inherit
      border-radius: round((base-line * 2), 2)
      margin-right: round((base-line / 6), 2)
      &.icon
        fill: blue
    & > address
      & > time
        color: red
      & > h3
        line-height: 1
        display: inline-block
</style>
