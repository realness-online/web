<script setup>
  import Icon from '@/components/icon'
  import { use_me } from '@/use/people'
  import { nextTick as tick, computed } from 'vue'
  import { Relation } from '@/persistance/Storage'
  const props = defineProps({
    person: {
      type: Object,
      required: true
    }
  })
  const { relations } = use_me()
  const is_relation = computed(() =>
    relations.value.some(relation => relation.id === props.person.id)
  )
  const update_relationship = async () => {
    if (is_relation.value) {
      const index = relations.value.findIndex(p => p.id === props.person.id)
      if (index > -1) relations.value.splice(index, 1)
      if (!relations.value.length)
        localStorage.removeItem(`${localStorage.me}/relations`)
    } else relations.value.push(props.person)
    await tick()
    await new Relation().save()
  }
</script>

<template>
  <a
    class="status"
    :class="{ relation: is_relation }"
    @click="update_relationship">
    <icon name="add" />
    <icon name="finished" />
  </a>
</template>

<style lang="stylus">
  figure.profile > figcaption > menu > a.status
    svg
      transition: fill, width, height
      transition-duration: 0.5s
      cursor: pointer
      fill: blue
      width:  base-line
      height: base-line
      &.finished
        fill: green
        height: 0
        width: 0
    &.relation
      svg.add
        height: 0
        width: 0
      svg.finished
        width:  base-line
        height: base-line
</style>
