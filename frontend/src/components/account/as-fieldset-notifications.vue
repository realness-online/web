<script setup>
  import { computed, onMounted as mounted } from 'vue'
  import { use_push } from '@/use/push'
  import { use_instance_capabilities } from '@/use/instance-capabilities'
  import { notifications } from '@/utils/preference'

  defineOptions({ name: 'AsFieldsetNotifications' })

  const { status, busy, refresh, enable, disable } = use_push()
  const { push: push_available, probe } = use_instance_capabilities()

  const available = computed(
    () => push_available.value && status.value !== 'unsupported'
  )

  mounted(async () => {
    await probe()
    if (!push_available.value) {
      if (notifications.value) notifications.value = false
      return
    }

    await refresh()
    if (notifications.value && status.value !== 'on') {
      const ok = await enable()
      if (!ok) notifications.value = false
    }
    if (!notifications.value && status.value === 'on') await disable()
  })

  const on_toggle = async event => {
    if (!push_available.value) return
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
  <fieldset data-preference>
    <div>
      <h4>Get notified</h4>
      <label>
        <input
          type="checkbox"
          name="notifications"
          role="switch"
          switch
          :checked="notifications"
          :disabled="
            busy ||
            !available ||
            status === 'blocked' ||
            status === 'needs-install'
          "
          @change="on_toggle" />
        <span data-slider></span>
      </label>
    </div>
    <p v-if="status === 'blocked'" data-hint>
      Turn notifications on in your browser settings.
    </p>
    <p v-else-if="status === 'needs-install'" data-hint>
      Add Realness to your home screen first.
    </p>
    <p v-else-if="status === 'unsupported'" data-hint>
      Not supported in this browser.
    </p>
    <p v-else-if="!push_available" data-hint>Not available.</p>
    <p v-else data-hint>
      Just a friendly nudge that we're here, sent Thursdays at 3pm PST.
    </p>
  </fieldset>
</template>
