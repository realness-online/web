<script setup>
  import Icon from '@/components/icon'
  import AsPath from '@/components/posters/as-path'
  import AsMasks from '@/components/posters/as-masks'
  import AsBackground from '@/components/posters/as-background'
  import AsGradients from '@/components/posters/as-gradients'
  import AsAnimation from '@/components/posters/as-animation'
  import { useIntersectionObserver as use_intersect } from '@vueuse/core'
  import {
    watchEffect as watch,
    onMounted as mounted,
    ref,
    computed,
    provide
  } from 'vue'
  import {
    use as use_poster,
    is_vector,
    is_vector_id,
    is_click,
    is_focus
  } from '@/use/poster'
  import {
    animate as animate_pref,
    drama,
    background,
    bold,
    medium,
    regular,
    light,
    fill,
    stroke,
    cutout,
    boulder,
    rock,
    gravel,
    sand,
    sediment
  } from '@/utils/preference'
  const props = defineProps({
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    },
    sync_poster: {
      type: Object,
      required: false,
      default: null,
      validator: is_vector
    }
  })
  const emit = defineEmits({
    focus: is_focus,
    click: is_click,
    show: is_vector
  })
  const {
    query,
    fragment,
    viewbox,
    aspect_ratio,
    working,
    show,
    focusable,
    tabindex,
    vector,
    vector_element,
    intersecting,
    is_hovered,
    dynamic_viewbox,
    focus,
    should_ken_burns,
    ken_burns_range
  } = use_poster()

  const trigger = ref(null)
  const animate = computed(
    () => animate_pref.value === true && intersecting.value
  )
  const landscape = computed(() => {
    if (!vector.value) return false
    const numbers = vector.value.viewbox.split(' ')
    const width = parseInt(numbers[2])
    const height = parseInt(numbers[3])
    return width > height
  })

  provide('vector', vector)

  mounted(() => {
    if (!props.sync_poster)
      use_intersect(trigger, ([{ isIntersecting }]) => {
        if (isIntersecting) {
          intersecting.value = true
          show()
        }
      })
    else {
      intersecting.value = true
      vector.value = props.sync_poster
      working.value = false
      emit('show', vector.value)
    }
  })

  watch(() => {
    if (props.sync_poster) {
      intersecting.value = true
      vector.value = props.sync_poster
      working.value = false
      emit('show', vector.value)
    }
  })

  const background_visible = computed(() => background.value)
  const light_visible = computed(() => vector.value?.light && light.value)
  const regular_visible = computed(() => vector.value?.regular && regular.value)
  const medium_visible = computed(() => vector.value?.medium && medium.value)
  const bold_visible = computed(() => vector.value?.bold && bold.value)

  const boulder_visible = computed(
    () => cutout.value && boulder.value && vector.value?.boulder
  )
  const rock_visible = computed(
    () => cutout.value && rock.value && vector.value?.rock
  )
  const gravel_visible = computed(
    () => cutout.value && gravel.value && vector.value?.gravel
  )
  const sand_visible = computed(
    () => cutout.value && sand.value && vector.value?.sand
  )
  const sediment_visible = computed(
    () => cutout.value && sediment.value && vector.value?.sediment
  )
</script>

<template>
  <icon v-if="working" ref="trigger" name="working" :tabindex="focusable" />
  <svg
    v-else
    ref="vector_element"
    :id="query()"
    itemscope
    itemtype="/posters"
    :itemid="itemid"
    :viewBox="dynamic_viewbox"
    :preserveAspectRatio="aspect_ratio"
    :tabindex="focusable"
    :class="{
      animate,
      landscape,
      hovered: is_hovered
    }">
    <g
      class="ken-burns-content"
      :style="{ '--ken-burns-range': `${ken_burns_range}%` }"
      :class="{ 'ken-burns': should_ken_burns }">
      <rect
        v-show="fill || stroke"
        :fill="`url(${fragment('shadow')})`"
        width="100%"
        height="100%" />
      <rect
        v-show="drama"
        id="lightbar-back"
        fill="url(#lightbar)"
        width="111%"
        height="133%" />

      <g class="cutouts">
        <slot>
          <use
            v-if="boulder_visible"
            :key="`${itemid}-boulder-use`"
            :id="query('boulder-use')"
            itemprop="boulder"
            :href="fragment('boulder')" />
          <use
            v-if="rock_visible"
            :key="`${itemid}-rock-use`"
            :id="query('rock-use')"
            itemprop="rock"
            :href="fragment('rock')" />
          <use
            v-if="gravel_visible"
            :key="`${itemid}-gravel-use`"
            :id="query('gravel-use')"
            itemprop="gravel"
            :href="fragment('gravel')" />
          <use
            v-if="sand_visible"
            :key="`${itemid}-sand-use`"
            :id="query('sand-use')"
            itemprop="sand"
            :href="fragment('sand')" />
          <use
            v-if="sediment_visible"
            :key="`${itemid}-sediment-use`"
            :id="query('sediment-use')"
            itemprop="sediment"
            :href="fragment('sediment')" />
        </slot>
      </g>
      <rect
        v-show="drama"
        id="lightbar-front"
        fill="url(#lightbar)"
        width="222%"
        height="200%" />
    </g>
    <defs>
      <symbol id="grid-overlay" viewBox="0 0 1 1">
        <rect width="1.00" height="0.33" />
        <rect width="1.00" height="0.33" y="0.33" rx="0.011" />
        <rect width="1.00" height="0.33" y="0.66" rx="0.011" />
        <rect width="0.33" height="0.33" y="0.33" x="0.33" rx="0.011" />
      </symbol>
      <pattern
        :id="query('shadow')"
        :width="vector.width"
        :height="vector.height"
        :viewBox="viewbox"
        patternUnits="userSpaceOnUse"
        :preserveAspectRatio="aspect_ratio">
        <as-background
          v-show="background_visible"
          :id="query('background')"
          :rect="vector.background"
          :width="vector.width"
          :height="vector.height"
          :tabindex="tabindex"
          fill-opacity="1"
          :fill="`url(${fragment('radial-background')})`"
          @focus="focus('background')" />
        <as-path
          v-show="light_visible"
          :id="query('light')"
          itemprop="light"
          :path="vector.light"
          :tabindex="tabindex"
          :mask="`url(${fragment('horizontal-mask')})`"
          :fill="`url(${fragment('vertical-light')})`"
          :stroke="`url(${fragment('horizontal-medium')})`"
          @focus="focus('light')" />
        <as-path
          v-show="regular_visible"
          :id="query('regular')"
          itemprop="regular"
          :path="vector.regular"
          :tabindex="tabindex"
          :mask="`url(${fragment('radial-mask')})`"
          :fill="`url(${fragment('horizontal-regular')})`"
          :stroke="`url(${fragment('vertical-bold')})`"
          @focus="focus('regular')" />
        <as-path
          v-show="medium_visible"
          :id="query('medium')"
          itemprop="medium"
          :path="vector.medium"
          :tabindex="tabindex"
          :mask="`url(${fragment('vertical-mask')})`"
          :fill="`url(${fragment('vertical-medium')})`"
          :stroke="`url(${fragment('vertical-background')})`"
          @focus="focus('medium')" />
        <as-path
          v-show="bold_visible"
          :id="query('bold')"
          itemprop="bold"
          :tabindex="tabindex"
          :path="vector.bold"
          :mask="`url(${fragment('horizontal-mask')})`"
          :fill="`url(${fragment('vertical-bold')})`"
          :stroke="`url(${fragment('radial-light')})`"
          @focus="focus('bold')" />
      </pattern>
      <as-gradients v-if="vector" :vector="vector" />
      <as-masks :itemid="itemid" />
    </defs>
    <as-animation v-if="animate && vector" :id="itemid" />
  </svg>
</template>

<style>
  @keyframes cutout-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 0.5;
    }
  }

  @keyframes ken-burns {
    0% {
      transform: translateY(calc(var(--ken-burns-range) * -1));
    }
    50% {
      transform: translateY(var(--ken-burns-range));
    }
    100% {
      transform: translateY(calc(var(--ken-burns-range) * -1));
    }
  }

  /* aspect-ratio: 2.76 / 1 // also film  28 years later used*/
  /* aspect-ratio: 2.35 / 1 // current film */
  /* aspect-ratio: 1.618 / 1 // golden-ratio */
  /* aspect-ratio: 16 / 9 // most like human vision */
  /* aspect-ratio: 1 / 1 // square */
  svg[itemtype='/posters'] {
    display: block;
    min-height: 512px;
    height: 100%;
    width: 100%;
    outline: none;
    cursor: grab;
    transition: all 0.3s ease;
    -webkit-tap-highlight-color: transparent;
    contain: layout;
    &:active {
      cursor: grabbing;
    }
    & g.ken-burns-content.ken-burns {
      transform-origin: center center;
      animation: ken-burns 20s ease-in-out infinite;
    }
    & rect#lightbar-back,
    & rect#lightbar-front,
    & > rect:first-of-type,
    & pattern path[itemprop],
    & pattern rect[itemprop='background'] {
      pointer-events: none;
      transition:
        opacity 0.75s ease,
        display 1.66s ease;
      transition-behavior: allow-discrete;
      @starting-style {
        opacity: 0;
      }
    }
    & use[itemprop='sediment'],
    & use[itemprop='sand'],
    & use[itemprop='gravel'],
    & use[itemprop='rock'],
    & use[itemprop='boulder'] {
      opacity: 0;
      filter: saturate(100%) brightness(100%);
      will-change: opacity, filter;
      transition:
        filter 0.35s ease-out,
        opacity 0.75s ease,
        display 1.66s ease;
      transition-behavior: allow-discrete;
      animation-name: cutout-fade;
      animation-duration: 0.9s;
      animation-timing-function: cubic-bezier(0.22, 0.61, 0.36, 1);
      animation-fill-mode: both;
      animation-iteration-count: 1;
      @starting-style {
        opacity: 0;
      }

      &:hover {
        transition: filter 0.33s ease;
        filter: saturate(120%) brightness(113%);
      }
      &:active {
        filter: saturate(166%) brightness(130%);
      }
      &:focus {
        filter: saturate(150%) brightness(118%);
      }
    }

    /* Staggered appearance: largest first */
    & use[itemprop='boulder'] {
      animation-delay: 0.12s;
    }
    & use[itemprop='rock'] {
      animation-delay: 0.24s;
    }
    & use[itemprop='gravel'] {
      animation-delay: 0.36s;
    }
    & use[itemprop='sand'] {
      animation-delay: 0.48s;
    }
    & use[itemprop='sediment'] {
      animation-delay: 0.6s;
    }

    /* Accessibility: no motion */
    @media (prefers-reduced-motion: reduce) {
      & use[itemprop='sediment'],
      & use[itemprop='sand'],
      & use[itemprop='gravel'],
      & use[itemprop='rock'],
      & use[itemprop='boulder'] {
        animation: none !important;
        opacity: 0.5;
      }
    }
  }
</style>
