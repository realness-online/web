<script setup>
  import Icon from '@/components/icon'
  import ProfileAsMeta from '@/components/profile/as-meta'
  import AsRelationshipOptions from '@/components/profile/as-relationship-options'
  import AsSvg from '@/components/posters/as-svg'
  import AsPosterSymbol from '@/components/posters/as-poster-symbol'
  import AsAddress from '@/components/profile/as-address'
  import AsMessenger from '@/components/profile/as-messenger'
  import { useRouter as use_router } from 'vue-router'
  import { computed, ref, provide } from 'vue'
  import { use_me, is_person } from '@/use/people'
  /** @typedef {import('@/types').Id} Id */
  import { as_layer_id, load_from_cache } from '@/utils/itemid'
  import { geology_layers } from '@/use/poster'
  import { get } from 'idb-keyval'
  const props = defineProps({
    person: {
      type: Object,
      required: true,
      validator: is_person
    },
    editable: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const router = use_router()
  const { relations, me } = use_me()

  const is_me = computed(() => {
    if (localStorage.me === props.person.id) return true
    return false
  })

  const person = computed(() => {
    if (me.value && me.value.id === props.person.id) return me.value
    return props.person
  })

  const avatar_click = () => {
    const route_path = { path: props.person.id }
    router.push(route_path)
  }

  const vector = ref(null)
  const shown = ref(false)

  provide('vector', vector)

  const on_show = shown_vector => {
    if (!shown_vector) return
    vector.value = shown_vector
    if (!vector.value.cutouts) {
      vector.value.cutouts = {}
      geology_layers.forEach(layer => {
        const layer_id = as_layer_id(
          /** @type {Id} */ (props.person.avatar),
          layer
        )
        get(layer_id).then(html_string => {
          if (html_string) vector.value.cutouts[layer] = true
        })
        load_from_cache(layer_id).then(({ html }) => {
          if (html) vector.value.cutouts[layer] = true
        })
      })
    }
    shown.value = true
  }
</script>

<template>
  <figure class="profile">
    <as-svg
      v-if="person.avatar"
      :itemid="person.avatar"
      :tabable="editable"
      @show="on_show"
      @click="avatar_click" />
    <icon v-else name="silhouette" @click="avatar_click" />
    <as-poster-symbol
      v-if="person.avatar && shown"
      :itemid="person.avatar"
      :vector="vector"
      :shown="shown" />
    <figcaption>
      <as-address :key="person.id" :person="person" :editable="editable" />
      <menu>
        <slot v-if="!is_me">
          <profile-as-meta :people="relations" />
          <as-relationship-options :person="person" />
          <as-messenger :itemid="person.id" />
        </slot>
        <slot v-else />
      </menu>
    </figcaption>
  </figure>
</template>

<style lang="stylus">
  figure.profile {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    justify-content: space-between;
    #background, svg.icon.silhouette {
      fill: blue;
    }
    & > svg {
      margin-right: round((base-line * .33), 3);
      min-height: inherit;
      width: round(base-line * 6, 2);
      height: round(base-line * 6, 2);
      cursor: pointer;
      @media (max-width: pad-begins) {
        border-top-right-radius: 0.66rem;
        border-bottom-right-radius: 0.66rem;
      }
      @media (min-width: pad-begins) {
        border-radius: 0.66rem;
      }
      &.background {
        fill: blue;
      }
    }
    & > figcaption {
      flex: 1;
      display: flex;
      justify-content: space-between;
      & > address
      & > menu {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      & > address {
        justify-content: center;
      }
      & > menu {
        padding: base-line * .33;
        &:hover {
          opacity: 1;
        }
      }
    }
  }
</style>
