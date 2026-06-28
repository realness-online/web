<script setup>
  import { onMounted as mounted } from 'vue'
  import { use_push } from '@/use/push'

  defineOptions({ name: 'AsNotifications' })

  const { status, busy, refresh, enable, disable } = use_push()

  mounted(refresh)

  // The toggle tap is the user gesture the browser/OS requires to prompt.
  const toggle = async event => {
    if (event.target.checked) await enable()
    else await disable()
    await refresh()
  }
</script>

<template>
  <section v-if="status !== 'unsupported'" class="as-notifications">
    <div>
      <h4>Get notified</h4>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          switch
          :checked="status === 'on'"
          :disabled="busy || status === 'blocked' || status === 'needs-install'"
          @change="toggle" />
        <span class="slider"></span>
      </label>
    </div>
    <small v-if="status === 'blocked'">
      Turn notifications on in your browser settings.
    </small>
    <small v-else-if="status === 'needs-install'">
      Add Realness to your home screen first.
    </small>
  </section>
</template>

<style lang="stylus">
  section.as-notifications
    padding: base-line 0
    border-top: 1px solid blue
    margin-top: base-line * 2
    & > div
      display: flex
      justify-content: space-between
      align-items: center
      gap: base-line * 0.5
      & > h4
        margin: 0
        font-size: normal
        font-weight: 300
    & > small
      display: block
      margin-top: base-line * 0.33
      opacity: 0.7
</style>
