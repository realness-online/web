<script setup>
  import { onMounted } from 'vue'
  import { use_push } from '@/use/push'
  import { notifications } from '@/utils/preference'

  defineOptions({ name: 'AsNotifications' })

  const { status, busy, refresh, enable, disable } = use_push()

  // Sync preference to actual subscription state on mount
  onMounted(async () => {
    await refresh()
    if (notifications.value && status.value !== 'on') {
      const ok = await enable()
      if (!ok) notifications.value = false
    }
    if (!notifications.value && status.value === 'on') await disable()
  })

  const toggle = async event => {
    if (event.target.checked) {
      const ok = await enable()
      notifications.value = ok
    } else {
      await disable()
      notifications.value = false
    }
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
          :checked="notifications"
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
