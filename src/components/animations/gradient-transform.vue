<template>
  <animate
    v-if="bold"
    attributeName="gradientTransform"
    dur="8s"
    values="rotate(0); rotate(-90);rotate(0);rotate(56);rotate(0);rotate(-10);rotate(90);rotate(0);"
    repeatCount="indefinite" />
  <animate
    v-if="regular"
    attributeName="gradientTransform"
    dur="21s"
    values="rotate(0); rotate(-180);rotate(0);rotate(90);rotate(0);rotate(-90);rotate(180);rotate(0);"
    repeatCount="indefinite" />
  <animate
    v-if="light"
    attributeName="gradientTransform"
    dur="13s"
    values="rotate(0); rotate(-30);rotate(0);rotate(60);rotate(0);rotate(-30);rotate(60);rotate(0);"
    repeatCount="indefinite" />
  <animate
    v-if="background"
    attributeName="gradientTransform"
    dur="21s"
    values="rotate(0);rotate(-60);rotate(0);rotate(60);rotate(0);rotate(-180);rotate(60);rotate(0);"
    repeatCount="indefinite" />
</template>


<script setup>
  defineProps({
    bold: {
      type: Boolean,
      required: false,
      default: false,
    },
    regular: {
      type: Boolean,
      required: false,
      default: false,
    },
    light: {
      type: Boolean,
      required: false,
      default: false,
    },
    background: {
      type: Boolean,
      required: false,
      default: true,
    }
  })
</script>
