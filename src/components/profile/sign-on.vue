<script setup>
  import { useRouter } from 'vue-router'

  defineOptions({
    name: 'SignOn'
  })

  const router = useRouter()

  const sign_on = () => {
    router.push({ path: '/sign-on' })
  }
</script>

<template>
  <button class="sign-on" @click="sign_on"><slot>Sign on</slot></button>
</template>
