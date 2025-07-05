<script setup>
  import { as_fragment_id } from '@/utils/itemid'
  import { is_vector_id } from '@/use/poster'
  /** @typedef {import('@/types').Id} Id */

  import { stroke } from '@/utils/preference'
  const props = defineProps({
    id: {
      type: String,
      required: true,
      /** @type {(id: string) => id is Id} */
      validator: is_vector_id
    }
  })
  /** @param {string} add */
  const fragment = add => `${as_fragment_id(props.id)}-${add}`
</script>

<template>
  <g itemprop="animation">
    <g v-if="stroke" class="stroke">
      <animate
        :href="fragment('light')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        dur="3s"
        values="0.9;0.1;0.9" />
      <animate
        :href="fragment('regular')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        dur="5s"
        values="0.9;0.1;0.9" />
      <animate
        :href="fragment('medium')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        dur="8s"
        values="0.9;0.1;0.9" />
      <animate
        :href="fragment('bold')"
        attributeName="stroke-opacity"
        repeatCount="indefinite"
        dur="3s"
        values="0.9;0.1;0.9" />

      <animate
        :href="fragment('light')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        dur="4s"
        values="0.33;0.66;0.33" />
      <animate
        :href="fragment('regular')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        dur="6s"
        values="0.33;0.55;0.33" />
      <animate
        :href="fragment('medium')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        dur="3s"
        values="0.33;0.83;0.33" />
      <animate
        :href="fragment('bold')"
        attributeName="stroke-width"
        repeatCount="indefinite"
        dur="4s"
        values="0.33;1;0.33" />

      <animate
        :href="fragment('light')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        dur="3s"
        values="0;-24"
        keyTimes="0;1"
        keySplines="0.4 0 0.6 1" />
      <animate
        :href="fragment('regular')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        dur="5s"
        values="0;-34"
        keyTimes="0;1"
        keySplines="0.4 0 0.6 1" />
      <animate
        :href="fragment('medium')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        dur="2s"
        values="0;-44"
        keyTimes="0;1"
        keySplines="0.4 0 0.6 1" />
      <animate
        :href="fragment('bold')"
        attributeName="stroke-dashoffset"
        repeatCount="indefinite"
        dur="3s"
        values="0;-56"
        keyTimes="0;1"
        keySplines="0.4 0 0.6 1" />
    </g>

    <animate
      :href="fragment('light')"
      attributeName="fill-opacity"
      repeatCount="indefinite"
      dur="5s"
      values="0.9;0.75;0.9;0.21;0.9" />
    <animate
      :href="fragment('medium')"
      attributeName="fill-opacity"
      repeatCount="indefinite"
      dur="13s"
      values="0.9;0.6;0.9;0.5;0.9;" />
    <animate
      :href="fragment('bold')"
      attributeName="fill-opacity"
      repeatCount="indefinite"
      dur="8s"
      values="0.9;0.75;0.9;0.6;0.8;0.9;" />

    <animate
      :href="fragment('radial-background')"
      attributeName="cx"
      repeatCount="indefinite"
      dur="34s"
      values="0%;150%;-50%;200%;0%" />
    <animate
      :href="fragment('radial-background')"
      attributeName="cy"
      repeatCount="indefinite"
      dur="55s"
      values="0%;200%;-25%;150%;0%" />
    <animate
      :href="fragment('vertical-light')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="55s"
      values="0%;-50%;150%;200%;0%" />
    <animate
      :href="fragment('vertical-light')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="86s"
      values="0%;250%;-75%;175%;0%" />
    <animate
      :href="fragment('horizontal-regular')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="34s"
      values="0%;200%;-100%;300%;0%" />
    <animate
      :href="fragment('horizontal-regular')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="55s"
      values="0%;-50%;200%;150%;0%" />
    <animate
      :href="fragment('vertical-medium')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="34s"
      values="0%;175%;-75%;225%;0%" />
    <animate
      :href="fragment('vertical-medium')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="55s"
      values="0%;300%;-100%;200%;0%" />
    <animate
      :href="fragment('vertical-bold')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="34s"
      values="0%;-100%;200%;300%;0%" />
    <animate
      :href="fragment('vertical-bold')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="55s"
      values="0%;250%;-150%;175%;0%" />

    <animate
      :href="fragment('radial')"
      attributeName="cx"
      repeatCount="indefinite"
      dur="42s"
      values="0%;200%;-100%;250%;0%" />
    <animate
      :href="fragment('radial')"
      attributeName="cy"
      repeatCount="indefinite"
      dur="67s"
      values="0%;-75%;300%;150%;0%" />

    <animate
      :href="fragment('vertical-background')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="38s"
      values="0%;300%;-150%;200%;0%" />
    <animate
      :href="fragment('vertical-background')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="61s"
      values="0%;175%;-100%;250%;0%" />

    <animate
      :href="fragment('horizontal-light')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="47s"
      values="0%;-100%;250%;300%;0%" />
    <animate
      :href="fragment('horizontal-light')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="73s"
      values="0%;300%;-200%;175%;0%" />

    <animate
      :href="fragment('horizontal-medium')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="29s"
      values="0%;225%;-125%;275%;0%" />
    <animate
      :href="fragment('horizontal-medium')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="51s"
      values="0%;-150%;250%;200%;0%" />

    <animate
      :href="fragment('horizontal-bold')"
      attributeName="x1"
      repeatCount="indefinite"
      dur="36s"
      values="0%;350%;-200%;300%;0%" />
    <animate
      :href="fragment('horizontal-bold')"
      attributeName="y1"
      repeatCount="indefinite"
      dur="58s"
      values="0%;275%;-175%;225%;0%" />

    <animate
      href="#lightbar-rect"
      attributeName="fill-opacity"
      repeatCount="indefinite"
      dur="21s"
      values="1;0.66;1"
      keyTimes="0;0.66;1"
      keySplines="0.4 0 0.6 1" />
  </g>
</template>
