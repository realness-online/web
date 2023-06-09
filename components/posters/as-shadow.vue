<template>
  <g v-if="shadow" itemprop="shadow">
    <filter
      id="shadow-light"
      x="0"
      y="0"
      :width="vector.width"
      :height="vector.height"
      filterUnits="userSpaceOnUse"
      color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix" />
      <feColorMatrix
        in="SourceAlpha"
        type="matrix"
        result="hardAlpha"
        values="0 0 0 0   0
                0 0 0 0   0
                0 0 0 0   0
                0 0 0 127 0" />
      <feOffset dx="1" dy="1" />
      <feGaussianBlur stdDeviation=".75" />
      <feColorMatrix
        type="matrix"
        values="0 0 0 0    0
                0 0 0 0    0
                0 0 0 0    0
                0 0 0 0.39 0" />
      <feBlend
        mode="normal"
        in2="BackgroundImageFix"
        result="effect1_dropShadow_1_2" />
      <feBlend
        mode="normal"
        in="SourceGraphic"
        in2="effect1_dropShadow_1_2"
        result="shape" />
    </filter>
    <filter
      id="shadow-regular"
      x="0"
      y="0"
      :width="vector.width"
      :height="vector.height"
      filterUnits="userSpaceOnUse"
      color-interpolation-filters="sRGB">
      <feFlood flood-opacity=".08" result="BackgroundImageFix" />
      <feBlend
        mode="normal"
        in="SourceGraphic"
        in2="BackgroundImageFix"
        result="shape" />
      <feColorMatrix
        in="SourceAlpha"
        type="matrix"
        values="0 0 0 0   0
                0 0 0 0   0
                0 0 0 0   0
                0 0 0 127 0"
        result="hardAlpha" />
      <feOffset dx="1" dy="1" />
      <feGaussianBlur stdDeviation=".5" />
      <feComposite in2="hardAlpha" operator="arithmetic" k2="-2" k3="1" />
      <feColorMatrix
        type="matrix"
        values="0 0 0 0    0.1196
                0 0 0 0    0.12896
                0 0 0 0    0.1404
                0 0 0 0.45 0" />
      <feBlend mode="normal" in2="shape" result="effect1_innerShadow_1_2" />
    </filter>
    <filter
      id="filter-bold"
      x="0"
      y="0"
      :width="vector.width"
      :height="vector.height"
      filterUnits="userSpaceOnUse"
      color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix" />
      <feColorMatrix
        in="SourceAlpha"
        type="matrix"
        values="0 0 0 0   0
                0 0 0 0   0
                0 0 0 0   0
                0 0 0 12 0"
        result="hardAlpha" />
      <feOffset dx="-1" />
      <feGaussianBlur stdDeviation="0.5" />
      <feComposite in2="hardAlpha" operator="out" />
      <feColorMatrix
        type="matrix"
        values="0 0 0 0    0.6294
                0 0 0 0    0.65694
                0 0 0 0    0.6906
                0 0 0 0.75 0" />
      <feBlend
        mode="normal"
        in2="BackgroundImageFix"
        result="effect1_dropShadow_1_2" />
      <feBlend
        mode="normal"
        in="SourceGraphic"
        in2="effect1_dropShadow_1_2"
        result="shape" />
    </filter>
  </g>
</template>
<script setup>
  import { computed } from 'vue'
  import { is_vector } from '@/use/vector'
  defineProps({
    vector: {
      type: Object,
      required: true,
      validator: is_vector
    }
  })
  const shadow = computed(() => localStorage.shadow)
  const query = add => `${as_query_id(props.vector.id)}-${add}`
  const fragment = add => `${as_fragment_id(props.vector.id)}-${add}`
</script>
