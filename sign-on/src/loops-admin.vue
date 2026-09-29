<script setup>
  import { onMounted, onUnmounted, ref, watch } from 'vue'
  import AsSignOn from '@/components/as-sign-on.vue'
  import { current_user } from '@/utils/firebase'
  import { list_loops, stop_loop } from '@/utils/loops'

  /* Every loop on every host, for a global admin. Sync decides who that is;
     this page only shows what sync lets it read. */
  defineOptions({ name: 'LoopsAdmin' })

  const sync_url = import.meta.env.VITE_BRAYNESS_SYNC_URL
  const loops = ref(/** @type {any[] | null} */ (null))
  const error = ref('')
  const remaining = ref(/** @type {Record<string, number>} */ ({}))
  const deadlines = new Map()
  let timer
  let last_load = 0
  let loading = false

  const tick = () => {
    remaining.value = Object.fromEntries(
      [...deadlines].map(([id, deadline]) => [id, Math.max(0, Math.ceil((deadline - Date.now()) / 1000))])
    )
  }

  const load = async () => {
    const user = current_user.value
    if (!user || !sync_url || loading) return
    loading = true
    error.value = ''
    try {
      loops.value = await list_loops(sync_url, await user.getIdToken())
      last_load = Date.now()
      for (const loop of loops.value) {
        if (loop.status !== 'running') deadlines.delete(loop.id)
        else if (loop.stop_requested && !deadlines.has(loop.id)) deadlines.set(loop.id, Date.now() + 30_000)
      }
      tick()
    } catch (thrown) {
      error.value = thrown.message
    } finally {
      loading = false
    }
  }

  const on_stop = async id => {
    try {
      await stop_loop(sync_url, await current_user.value.getIdToken(), id)
      deadlines.set(id, Date.now() + 30_000)
      tick()
      await load()
    } catch (thrown) {
      error.value = thrown.message
    }
  }

  watch(current_user, load)
  onMounted(() => {
    load()
    timer = setInterval(() => {
      tick()
      if (Date.now() - last_load >= 5_000) load()
    }, 1000)
  })
  onUnmounted(() => clearInterval(timer))
</script>

<template>
  <section id="loops-admin" data-page>
    <h1>Loops</h1>
    <as-sign-on v-if="!current_user" />
    <p v-if="error" role="alert">{{ error }}</p>
    <table v-if="loops?.length">
      <thead>
        <tr>
          <th scope="col">Loop</th>
          <th scope="col">Owner</th>
          <th scope="col">Host</th>
          <th scope="col">Status</th>
          <th scope="col">Runs</th>
          <th scope="col">Tokens</th>
          <th scope="col">Start time</th>
          <th scope="col"><span hidden>Stop</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="loop in loops" :key="loop.id" :data-status="loop.status">
          <th scope="row" :title="loop.goal">{{ loop.id }}</th>
          <td>{{ loop.owner }}</td>
          <td>{{ loop.host }}</td>
          <td>{{ loop.reason ? `${loop.status}: ${loop.reason}` : loop.status }}</td>
          <td>{{ loop.runs }}</td>
          <td>{{ loop.tokens }}</td>
          <td><time :datetime="loop.started">{{ loop.started.slice(0, 16).replace('T', ' ') }}</time></td>
          <td>
            <button
              v-if="loop.status === 'running'"
              type="button"
              :disabled="loop.stop_requested"
              @click="on_stop(loop.id)">
              {{ loop.stop_requested ? 'Stopping' : 'Stop' }}
            </button>
            <output v-if="loop.status === 'running' && loop.stop_requested" :aria-label="`Estimated time to stop ${loop.id}`">
              {{ remaining[loop.id] == null ? '30s' : remaining[loop.id] ? `${remaining[loop.id]}s` : 'Checking...' }}
            </output>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="loops">No loops.</p>
  </section>
</template>
