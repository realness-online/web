<script setup>
  import Icon from '@/components/icon'
  import AsSvg from '@/components/posters/as-svg'
  import { Poster } from '@/persistance/Storage'
  import { useRoute as use_route, useRouter as use_router } from 'vue-router'
  import { provide, ref, watch, computed } from 'vue'
  import { use as use_vectorize } from '@/use/vectorize'

  const route = use_route()
  const router = use_router()
  const itemid = /** @type {import('@/types').Id} */ (
    `${localStorage.me}/posters/${Number(route.params.id)}`
  )
  const figure = ref(null)

  const back = () => {
    const me = localStorage.me.substring(2)
    const { id } = route.params
    new_gradients.value = null
    if (new_vector.value) {
      new_vector.value = null
      router.back()
    } else router.replace({ path: '/posters', hash: `#${me}-posters-${id}` })
  }

  const save = async () => {
    await new Poster(itemid).save()
    if (new_gradients.value) new_gradients.value = null
    back()
  }

  const { new_vector, new_gradients, new_cutouts, progress } = use_vectorize()

  watch(
    new_vector,
    vector => {
      if (vector) {
        provide('new-poster', true)
      }
    },
    { immediate: true }
  )

  const is_processing = computed(() => {
    return !new_vector.value && progress.value < 100
  })

  const progress_text = computed(() => {
    if (!is_processing.value) return ''
    return `Processing: ${Math.round(progress.value)}%`
  })
</script>

<template>
  <section id="editor" class="page">
    <header ref="header">
      <a @click="back"><icon name="remove" /></a>
      <a @click="save"><icon name="finished" /></a>
    </header>

    <figure ref="figure">
      <as-svg
        :itemid="itemid"
        :optimize="true"
        :slice="true"
        :tabable="true"
        tabindex="-1" />
    </figure>

    <footer v-if="progress < 100 && new_vector">
      <progress :value="progress" max="100"></progress>
      <span
        >{{ Math.round(progress) }}% – Cutouts:
        {{ new_vector.cutout?.length || 0 }}</span
      >
    </footer>
  </section>
</template>

<style lang="stylus">
  section#editor {
    & > header {
      align-items: center;
      z-index: 2;
      position: absolute;
      top: inset(0);
      left: 0;
      right: 0;
      padding: base-line;
      @media (min-width: pad-begins){
        padding: (base-line * 2) base-line base-line base-line;
      }
      & > h1 {
        cursor: pointer;
        margin: 0;
        color: red;
        position: relative;
        z-index: 2
        text-shadow: 1px 1px 1px black-background
      }
      & > a  > svg {
        cursor: pointer;
        fill: green;
        &.selected, &:hover {
          fill: red;
        }
        &.color > svg.opacity {
          fill: black-background;
          &:hover {
            fill: transparent;
          }
        }
        &.remove .fullscreen .finished {
          fill-opacity: inherit;
        }
        & > svg {
          z-index: 2;
          &.selected {
            stroke: red;
            fill: red;
          }
          &.grid {
            border: 1px solid green;
            border-radius: base-line * 0.15;
            transition: border-color;
            &:hover {
              transition: border-color;
              fill: green;
              border-color: red;
            }
          }
        }
      }
    }
    & > figure > svg {
      position: fixed;
      z-index: 0;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      @media (orientation: landscape) and (max-height: page-width) {
        max-height: 100dvh;
        min-height: inherit;
      }
    }
    & > footer {
      position fixed;
      left 0;
      right 0;
      top 0;
      z-index 20;
      display flex;
      align-items center;
      justify-content center;
      progress {
        width 80vw;
        margin-right 1em;
        accent-color var(--green);
      }
      span {
        font-size smaller;
      }
    }
  }
</style>
