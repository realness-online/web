<template>
  <icon v-if="working" ref="trigger" name="working" :tabindex="focusable" />
  <svg
    v-else
    :id="query()"
    itemscope
    :itemtype="`/${as_type(itemid)}`"
    :itemid="itemid"
    :viewBox="viewbox"
    :preserveAspectRatio="aspect_ratio"
    :tabindex="focusable"
    @click="click">
    <as-filters />
    <as-gradients :itemid="itemid" />
    <defs>
      <symbol :id="query('background')">
        <as-background :rect="vector.background" :tabable="tabable" />
      </symbol>
      <symbol v-if="vector.light" :id="query('light')">
        <as-path :path="vector.light" itemprop="light" />
      </symbol>
      <symbol v-if="vector.regular" :id="query('regular')">
        <as-path :path="vector.regular" itemprop="regular" />
      </symbol>
      <symbol v-if="vector.bold" :id="query('bold')">
        <as-path :path="vector.bold" itemprop="bold" />
      </symbol>
    </defs>
    <use
      class="background"
      :tabindex="tabindex"
      :href="fragment('background')"
      :fill="`url(${fragment('background-gradient')}`"
      @focus="focus('background')" />
    <use
      class="light"
      :tabindex="tabindex"
      :href="fragment('light')"
      :fill="`url(${fragment('light-gradient')}`"
      @focus="focus('light')" />
    <use class="emboss" :href="fragment('light')" filter="url(#emboss)" />
    <use
      class="regular"
      :tabindex="tabindex"
      :href="fragment('regular')"
      :fill="`url(${fragment('regular-gradient')}`"
      @focus="focus('regular')" />
    <use class="emboss" :href="fragment('regular')" filter="url(#emboss)" />
    <use
      class="bold"
      :tabindex="tabindex"
      :href="fragment('bold')"
      :fill="`url(${fragment('bold-gradient')}`"
      :filter="`url(#bold-filter)`"
      @focus="focus('bold')" />
    <use class="emboss" :href="fragment('bold')" filter="url(#emboss)" />
  </svg>
</template>
<script setup>
  import AsPath from '@/components/posters/as-path'
  import AsBackground from '@/components/posters/as-background'
  import AsGradients from '@/components/posters/as-gradients'
  import AsFilters from '@/components/posters/as-filters'
  import { useIntersectionObserver as use_intersect } from '@vueuse/core'
  import {
    onMounted as mounted,
    watchEffect as watch_effect,
    ref,
    inject
  } from 'vue'
  import { as_type } from '@/use/itemid'
  import {
    use_poster,
    is_vector,
    is_vector_id,
    is_click,
    is_focus
  } from '@/use/vector'
  import { use as use_vectorize } from '@/use/vectorize'
  import { use as use_optimizer } from '@/use/optimize'
  import icon from '@/components/icon'
  const emit = defineEmits({
    focus: is_focus,
    click: is_click,
    loaded: is_vector
  })
  const props = defineProps({
    immediate: {
      type: Boolean,
      required: false,
      default: false
    },
    optimize: {
      type: Boolean,
      required: false,
      default: false
    },
    toggle_aspect: {
      type: Boolean,
      required: false,
      default: true
    },
    slice: {
      type: Boolean,
      required: false,
      default: true
    },
    tabable: {
      type: Boolean,
      required: false,
      default: false
    },
    itemid: {
      type: String,
      required: true,
      validator: is_vector_id
    },
    as_stroke: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const {
    query,
    fragment,
    viewbox,
    aspect_ratio,
    click,
    working,
    show,
    focus,
    focusable,
    tabindex,
    vector
  } = use_poster(props, emit)
  const trigger = ref(null)

  if (inject('new-poster', false)) {
    const { new_vector } = use_vectorize()
    vector.value = new_vector.value
    working.value = false
  } else {
    if (!props.immediate) {
      use_intersect(
        trigger,
        ([{ isIntersecting }]) => {
          if (isIntersecting) show()
        },
        { rootMargin: '512px' }
      )
    }
  }
  watch_effect(() => {
    if (vector.value && props.optimize && !vector.value.optimized) {
      const { optimize } = use_optimizer(vector)
      optimize()
    }
  })
</script>
<style lang="stylus">
  svg[itemtype="/posters"]
  svg[itemtype="/avatars"]
    aspect-ratio: 16 / 9
    display: block
    min-height: 512px
    height: 100%
    width: 100%
    outline: none
    // use.bold, use.regular, use.light, use.emboss
    //   display: none
</style>
