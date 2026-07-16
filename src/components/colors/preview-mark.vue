<script setup>
  import icon from '@/components/icon'
  defineProps({
    name: {
      type: String,
      required: true
    },
    label: {
      type: String,
      default: 'icon'
    }
  })
  defineEmits(['cycle'])
</script>

<template>
  <button
    type="button"
    :aria-label="`Preview ${label} with icon: ${name}, click to cycle`"
    @click="$emit('cycle')">
    <icon :name="name" />
    <small>{{ name }}</small>
  </button>
</template>

<style>
  button[aria-label^='Preview '] {
    position: relative;
    display: block;
    width: calc(var(--base-line) * 1.5);
    height: calc(var(--base-line) * 1.5);
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    overflow: visible;
    & > svg.icon {
      display: block;
      width: 100%;
      height: 100%;
    }
    & > small {
      position: absolute;
      left: 100%;
      top: 50%;
      margin-left: calc(var(--base-line) * 0.1);
      transform: translateY(-50%);
      writing-mode: vertical-rl;
      font-size: smaller;
      line-height: 1;
      letter-spacing: 0.04em;
      opacity: 0.3;
      text-transform: lowercase;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }
    &:hover > small {
      opacity: 0.85;
    }
  }
</style>
