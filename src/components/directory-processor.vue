<script setup>
import { use_directory_processor } from '@/use/directory-processor'

const { process_directory } = use_directory_processor()
</script>

<template>
  <button @click="process_directory">
    Process Image Directory
  </button>
</template>
