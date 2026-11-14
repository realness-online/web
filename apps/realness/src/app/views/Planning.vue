<template>
  <article
    itemscope
    itemtype="https://schema.org/CollectionPage"
    aria-label="Plans">
    <header>
      <hgroup>
        <h1><router-link to="/">Realness</router-link></h1>
        <p>Planning</p>
      </hgroup>
      <nav v-if="areas.length" aria-label="Areas">
        <a v-for="area in areas" :key="area" :href="`?area=${area}`">
          {{ area }}
        </a>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <section v-else-if="shown.length" itemprop="hasPart">
      <ol>
        <PlanItem v-for="plan in shown" :key="plan.itemid" :plan="plan" />
      </ol>
    </section>
    <p v-else role="status">No plans yet.</p>
  </article>
</template>

<script setup>
  import {
    computed,
    nextTick as next_tick,
    onMounted as on_mounted,
    onUnmounted as on_unmounted,
    ref
  } from 'vue'
  import PlanItem from '@/components/plan/as-item.vue'
  import { draw_diagrams } from '@/utils/diagrams'
  import { current_user } from '@/utils/serverless'
  import { watch_vault } from '@/utils/vault-events'
  import '#root/tools/publish/renderer/static/scripts/diagrams.css'

  const body = ref(null)

  const plans = ref([])
  const error = ref('')
  const loading = ref(true)
  const chosen = ref(new URLSearchParams(location.search).get('area') ?? '')

  const areas = computed(() =>
    [...new Set(plans.value.map(plan => plan.area))].sort()
  )
  const shown = computed(() =>
    chosen.value
      ? plans.value.filter(plan => plan.area === chosen.value)
      : plans.value
  )

  const token_for = async () => (await current_user.value?.getIdToken()) ?? null

  const load = async () => {
    const token = await token_for()
    const response = await fetch('/v1/vault/plans', {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    loading.value = false
    if (!response.ok) {
      error.value = 'Your plans could not load.'
      return
    }
    const payload = await response.json()
    plans.value = Array.isArray(payload.plans) ? payload.plans : []
    if (!plans.value.length) return
    await next_tick()
    await draw_diagrams(body.value)
  }

  let stop_watching = () => {}

  on_mounted(async () => {
    await load()
    stop_watching = await watch_vault(() => load(), token_for)
  })
  on_unmounted(() => stop_watching())
</script>

<style lang="stylus">
  article[itemtype$='/CollectionPage'] {
    max-inline-size: 72rem;
    margin-inline: auto;
    padding-inline: var(--base-line);

    > header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-block: calc(var(--base-line) * 0.5);

      hgroup {
        display: flex;
        align-items: baseline;
        gap: calc(var(--base-line) * 0.5);
      }

      h1 {
        margin: 0;
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;

        a {
          color: var(--text);
          text-decoration: none;
        }
      }

      p {
        margin: 0;
        color: var(--muted-text);
        font-size: 0.75rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      nav {
        display: flex;
        flex-wrap: wrap;
        gap: calc(var(--base-line) * 0.5);
        font-size: 0.75rem;

        a {
          color: var(--accent);
          text-decoration: none;

          &:hover {
            color: var(--emphasis);
          }
        }
      }
    }

    > p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
    }

    > section {
      padding-block: calc(var(--base-line) * 2);

      ol {
        display: grid;
        gap: var(--base-line);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: baseline;
        gap: var(--base-line);
        padding-block: calc(var(--base-line) * 0.5);

        pre.mermaid {
          grid-column: 1 / -1;
          margin: 0;
          overflow-x: auto;
        }

        a {
          color: var(--text);
          font-weight: 600;
          text-decoration: none;
          border-block-end: 1px solid var(--muted-text);

          &:hover {
            color: var(--emphasis);
          }
        }

        p {
          display: flex;
          gap: calc(var(--base-line) * 0.5);
          margin: 0;
          color: var(--muted-text);
          font-size: 0.75rem;
          text-transform: uppercase;
        }
      }
    }
  }
</style>
