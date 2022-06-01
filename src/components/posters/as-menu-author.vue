<template>
  <event-as-fieldset
    v-if="poster.picker"
    :itemid="poster.id"
    @picker="emit('picker', poster.id)" />
  <menu v-else>
    <event-as-button :itemid="poster.id" @picker="emit('picker', poster.id)" />
    <router-link class="gear" :to="edit_poster(poster.id)">
      <icon name="gear" />
    </router-link>
    <a class="remove" @click="emit('remove', poster.id)">
      <icon name="remove" />
    </a>
    <a class="avatar" @click="emit('avatar', poster.id)">
      <icon name="silhouette" />
    </a>
    <as-download :itemid="poster.id" />
  </menu>
</template>
<script setup>
  import icon from '@/components/icon'
  import eventAsFieldset from '@/components/events/as-fieldset'
  import eventAsButton from '@/components/events/as-button'
  import asDownload from '@/components/download-vector'
  import { useRouter as use_router } from 'vue-router'
  import { watch } from 'vue'
  import {
    useMagicKeys as use_magic_keys,
    useActiveElement as use_active_element
  } from '@vueuse/core'
  import { as_created_at, as_type } from '@/use/itemid'
  import { is_vector_id } from '@/use/vector'
  const props = defineProps({
    poster: {
      type: Object,
      required: true
    }
  })
  const emit = defineEmits({
    remove: is_vector_id,
    picker: is_vector_id,
    avatar: is_vector_id
  })
  const router = use_router()
  const edit_poster = itemid =>
    `/${as_type(itemid)}/${as_created_at(itemid)}/editor`
  const open_editor = () =>
    router.replace({ path: edit_poster(props.poster.id) })
  const active = use_active_element()

  const { enter } = use_magic_keys()
  watch(enter, v => {
    if (v && active.value) {
      const clicked = parseInt(active.value.href?.baseVal.split('-')[2])
      const me = as_created_at(props.poster.id)
      if (clicked === me) open_editor()
    }
  })
</script>
<style lang="stylus">
  section#posters > article > figure.poster
    & > figcaption > menu > a
      &.avatar
        top: base-line
        left: calc(50% - 1em)
        &.selected > svg
          fill: red
      &.gear
        top: base-line
        right: base-line
      &.remove
        bottom: base-line
        left: base-line
      &.save
        bottom: base-line
        right: base-line
      &.event
        top: base-line
        left: base-line
      & > svg
        fill: green
</style>
