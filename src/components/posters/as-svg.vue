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
    onUnmounted as unmounted,
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
    drama_back,
    drama_front,
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
    sediment,
    slice,
    storytelling,
    aspect_ratio_mode
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
    ken_burns_range,
    ken_burns_position
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
  const drama_back_visible = computed(() => drama_back.value)
  const drama_front_visible = computed(() => drama_front.value)

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

  const shadow_layer_displayed = computed(
    () => fill.value || stroke.value
  )

  const hide_cursor = computed(() => slice.value && storytelling.value)

  const ken_burns_ready = ref(false)
  const ken_burns_timer = null

  const ken_burns_class = computed(() => {
    if (!should_ken_burns.value || !ken_burns_ready.value) return ''
    return `ken-burns-${ken_burns_position.value}`
  })

  watch(() => {
    if (should_ken_burns.value && !ken_burns_ready.value)
      ken_burns_ready.value = true
    else if (!should_ken_burns.value) ken_burns_ready.value = false
  })

  unmounted(() => {
    if (ken_burns_timer) clearTimeout(ken_burns_timer)
  })
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
    :style="slice && aspect_ratio_mode !== 'auto' ? { aspectRatio: aspect_ratio_mode } : {}"
    :class="{
      animate,
      landscape,
      hovered: is_hovered,
      'hide-cursor': hide_cursor
    }">
    <g
      :style="{ '--ken-burns-range': `${ken_burns_range}%` }"
      :class="ken_burns_class">
      <rect
        v-show="fill || stroke"
        :fill="`url(${fragment('shadow')})`"
        width="100%"
        height="100%" />
      <rect
        id="lightbar-back"
        fill="url(#lightbar)"
        x="-11%"
        y="0"
        width="200%"
        height="200%"
        :style="{ opacity: drama_back_visible ? 1 : 0, visibility: drama_back_visible ? 'visible' : 'hidden' }" />

      <g class="cutouts">
        <slot>
          <use
            v-if="intersecting"
            :key="`${itemid}-boulder-use`"
            :id="query('boulder-use')"
            itemprop="boulder"
            :href="fragment('boulder')"
            :style="{
              opacity: boulder_visible ? (shadow_layer_displayed ? 0.6 : 1) : 0,
              visibility: boulder_visible ? 'visible' : 'hidden'
            }" />
          <use
            v-if="intersecting"
            :key="`${itemid}-rock-use`"
            :id="query('rock-use')"
            itemprop="rock"
            :href="fragment('rock')"
            :style="{
              opacity: rock_visible ? (shadow_layer_displayed ? 0.6 : 1) : 0,
              visibility: rock_visible ? 'visible' : 'hidden'
            }" />
          <use
            v-if="intersecting"
            :key="`${itemid}-gravel-use`"
            :id="query('gravel-use')"
            itemprop="gravel"
            :href="fragment('gravel')"
            :style="{
              opacity: gravel_visible ? (shadow_layer_displayed ? 0.6 : 1) : 0,
              visibility: gravel_visible ? 'visible' : 'hidden'
            }" />
          <use
            v-if="intersecting"
            :key="`${itemid}-sand-use`"
            :id="query('sand-use')"
            itemprop="sand"
            :href="fragment('sand')"
            :style="{
              opacity: sand_visible ? (shadow_layer_displayed ? 0.55 : 1) : 0,
              visibility: sand_visible ? 'visible' : 'hidden'
            }" />
          <use
            v-if="intersecting"
            :key="`${itemid}-sediment-use`"
            :id="query('sediment-use')"
            itemprop="sediment"
            :href="fragment('sediment')"
            :style="{
              opacity: sediment_visible ? (shadow_layer_displayed ? 0.5 : 1) : 0,
              visibility: sediment_visible ? 'visible' : 'hidden'
            }" />
        </slot>
      </g>
      <rect
        id="lightbar-front"
        fill="url(#lightbar)"
        x="-61%"
        y="0"
        width="200%"
        height="200%"
        :style="{ opacity: drama_front_visible ? 1 : 0, visibility: drama_front_visible ? 'visible' : 'hidden' }" />
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
          :id="query('background')"
          :rect="vector.background"
          :width="vector.width"
          :height="vector.height"
          :tabindex="tabindex"
          :visible="background_visible"
          fill-opacity="1"
          :fill="`url(${fragment('radial-background')})`"
          @focus="focus('background')" />
        <as-path
          :id="query('light')"
          itemprop="light"
          :path="vector.light"
          :tabindex="tabindex"
          :visible="light_visible"

          :mask="`url(${fragment('horizontal-mask')})`"
          :fill="`url(${fragment('vertical-light')})`"
          :stroke="`url(${fragment('horizontal-medium')})`"
          @focus="focus('light')" />
        <as-path
          :id="query('regular')"
          itemprop="regular"
          :path="vector.regular"
          :tabindex="tabindex"
          :visible="regular_visible"
          :mask="`url(${fragment('radial-mask')})`"
          :fill="`url(${fragment('horizontal-regular')})`"
          :stroke="`url(${fragment('vertical-bold')})`"
          @focus="focus('regular')" />
        <as-path
          :id="query('medium')"
          itemprop="medium"
          :path="vector.medium"
          :tabindex="tabindex"
          :visible="medium_visible"
          :mask="`url(${fragment('vertical-mask')})`"
          :fill="`url(${fragment('vertical-medium')})`"
          :stroke="`url(${fragment('vertical-background')})`"
          @focus="focus('medium')" />
        <as-path
          :id="query('bold')"
          itemprop="bold"
          :tabindex="tabindex"
          :path="vector.bold"
          :visible="bold_visible"
          :mask="`url(${fragment('horizontal-mask')})`"
          :fill="`url(${fragment('vertical-bold')})`"
          :stroke="`url(${fragment('radial-light')})`"
          @focus="focus('bold')" />
      </pattern>
      <as-gradients v-if="vector" :vector="vector" />
      <as-masks :itemid="itemid" />
    </defs>
    <as-animation v-if="vector" :id="itemid" />
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

  @keyframes ken-burns-top {
    0% {
      transform: translateY(calc(var(--ken-burns-range) * -1));
    }
    25% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(var(--ken-burns-range));
    }
    75% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(calc(var(--ken-burns-range) * -1));
    }
  }

  @keyframes ken-burns-middle {
    0% {
      transform: translateY(0);
    }
    25% {
      transform: translateY(var(--ken-burns-range));
    }
    50% {
      transform: translateY(0);
    }
    75% {
      transform: translateY(calc(var(--ken-burns-range) * -1));
    }
    100% {
      transform: translateY(0);
    }
  }

  @keyframes ken-burns-bottom {
    0% {
      transform: translateY(var(--ken-burns-range));
    }
    25% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(calc(var(--ken-burns-range) * -1));
    }
    75% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(var(--ken-burns-range));
    }
  }

  @keyframes ken-burns-left {
    0% {
      transform: translateX(var(--ken-burns-range));
    }
    25% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(calc(var(--ken-burns-range) * -1));
    }
    75% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(var(--ken-burns-range));
    }
  }

  @keyframes ken-burns-center {
    0% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(var(--ken-burns-range));
    }
    50% {
      transform: translateX(0);
    }
    75% {
      transform: translateX(calc(var(--ken-burns-range) * -1));
    }
    100% {
      transform: translateX(0);
    }
  }

  @keyframes ken-burns-right {
    0% {
      transform: translateX(calc(var(--ken-burns-range) * -1));
    }
    25% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(var(--ken-burns-range));
    }
    75% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(calc(var(--ken-burns-range) * -1));
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
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    contain: layout;
    &.hide-cursor {
      cursor: none;
    }

    & > g {
      transform-origin: center center;
      &.ken-burns-top {
        animation: ken-burns-top 20s ease-in-out infinite;
      }
      &.ken-burns-middle {
        animation: ken-burns-middle 20s ease-in-out infinite;
      }
      &.ken-burns-bottom {
        animation: ken-burns-bottom 20s ease-in-out infinite;
      }
      &.ken-burns-left {
        animation: ken-burns-left 30s ease-in-out infinite;
      }
      &.ken-burns-center {
        animation: ken-burns-center 30s ease-in-out infinite;
      }
      &.ken-burns-right {
        animation: ken-burns-right 30s ease-in-out;
      }
    }
    & rect#lightbar-back,
    & rect#lightbar-front,
    & > rect:first-of-type,
    & pattern path[itemprop],
    & pattern rect[itemprop='background'] {
      pointer-events: none;
      transition:
        opacity 0.2s ease,
        visibility 0.2s ease;
      @starting-style {
        opacity: 0;
      }
    }
    & use[itemprop='sediment'],
    & use[itemprop='sand'],
    & use[itemprop='gravel'],
    & use[itemprop='rock'],
    & use[itemprop='boulder'] {
      opacity: 0.5;
      filter: saturate(100%) brightness(100%);
      will-change: opacity, filter, display;
      transition:
        filter 0.44s ease-in-out,
        opacity 0.44s ease-out,
        display 0.44s ease-out;
      transition-behavior: allow-discrete;

      @starting-style {
        opacity: 0;
      }

      &:hover {
        transition: filter 0.33s ease;
        filter: saturate(113%) brightness(108%);
      }
      &:active {
        /* cursor: grabbing; */
        filter: saturate(166%) brightness(130%);
      }
      &:focus {
        filter: saturate(150%) brightness(118%);
      }
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
