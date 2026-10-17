<script setup>
  import { current_user } from '@/utils/serverless'
  import { list_loops, stop_loop } from '@/utils/loops'
  import {
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref,
    watch
  } from 'vue'

  defineOptions({ name: 'LoopsAdmin' })

  const SECOND = 1000
  const STOP_GRACE_MS = 30_000
  const RELOAD_MS = 5_000
  const MINUTE_LENGTH = 16

  const loops = ref(/** @type {any[] | null} */ (null))
  const error = ref('')
  const remaining = ref(/** @type {Record<string, number>} */ ({}))
  const deadlines = new Map()
  let timer
  let last_load = 0
  let loading = false

  const tick = () => {
    remaining.value = Object.fromEntries(
      [...deadlines].map(([id, deadline]) => [
        id,
        Math.max(0, Math.ceil((deadline - Date.now()) / SECOND))
      ])
    )
  }

  const track = loop => {
    if (loop.status !== 'running') deadlines.delete(loop.id)
    else if (loop.stop_requested && !deadlines.has(loop.id))
      deadlines.set(loop.id, Date.now() + STOP_GRACE_MS)
  }

  const load = async () => {
    const user = current_user.value
    if (!user || loading) return
    loading = true
    error.value = ''
    try {
      loops.value = await list_loops(await user.getIdToken())
      last_load = Date.now()
      loops.value.forEach(track)
      tick()
    } catch (thrown) {
      error.value = thrown.message
    } finally {
      loading = false
    }
  }

  const on_stop = async id => {
    try {
      await stop_loop(await current_user.value.getIdToken(), id)
      deadlines.set(id, Date.now() + STOP_GRACE_MS)
      tick()
      await load()
    } catch (thrown) {
      error.value = thrown.message
    }
  }

  const countdown = id => {
    const left = remaining.value[id]
    if (left === undefined) return '30s'
    return left ? `${left}s` : 'Checking...'
  }
  const minute = iso => iso.slice(0, MINUTE_LENGTH).replace('T', ' ')

  watch(current_user, load)
  on_mounted(() => {
    load()
    timer = setInterval(() => {
      tick()
      if (Date.now() - last_load >= RELOAD_MS) load()
    }, SECOND)
  })
  on_unmounted(() => clearInterval(timer))
</script>

<template>
  <section id="loops-admin" data-page>
    <h1>Loops</h1>
    <p v-if="error" role="alert">{{ error }}</p>
    <table v-if="loops?.length">
      <thead>
        <tr>
          <th scope="col">Loop</th>
          <th scope="col">Owner</th>
          <th scope="col">Halo</th>
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
          <td>{{ loop.halo }}</td>
          <td>
            {{ loop.reason ? `${loop.status}: ${loop.reason}` : loop.status }}
          </td>
          <td>{{ loop.runs }}</td>
          <td>{{ loop.tokens }}</td>
          <td>
            <time :datetime="loop.started">{{ minute(loop.started) }}</time>
          </td>
          <td>
            <button
              v-if="loop.status === 'running'"
              type="button"
              :disabled="loop.stop_requested"
              @click="on_stop(loop.id)">
              {{ loop.stop_requested ? 'Stopping' : 'Stop' }}
            </button>
            <output
              v-if="loop.status === 'running' && loop.stop_requested"
              :aria-label="`Estimated time to stop ${loop.id}`">
              {{ countdown(loop.id) }}
            </output>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="loops">No loops.</p>
  </section>
</template>
