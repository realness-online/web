<template>
  <article
    itemscope
    itemtype="https://schema.org/CollectionPage"
    aria-label="Plans">
    <header>
      <nav v-if="plans.length" aria-label="Plans by state">
        <button
          v-for="state in states"
          :key="state.value"
          type="button"
          :data-state="state.value"
          :aria-pressed="String(chosen_state === state.value)"
          @click="choose_state(state.value)">
          {{ state.label }}
        </button>
      </nav>
      <nav v-if="areas.length" aria-label="Plans by area">
        <button
          type="button"
          data-area=""
          :aria-pressed="String(chosen === '')"
          @click="choose('')">
          All
        </button>
        <button
          v-for="area in areas"
          :key="area"
          type="button"
          :data-area="area"
          :aria-pressed="String(chosen === area)"
          @click="choose(area)">
          {{ area }}
        </button>
      </nav>
      <nav v-if="plans.some(plan => plan.archived)" aria-label="Archive">
        <button
          type="button"
          :aria-pressed="String(show_archived)"
          @click="toggle_archived">
          Archived
        </button>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <section v-else-if="plans.length" ref="body" itemprop="hasPart">
      <PlanCover
        v-for="plan in plans"
        :key="plan.itemid"
        :plan="plan"
        :hidden="!keeps(plan)" />
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
  import PlanCover from '@/components/plan/as-cover.vue'
  import {
    draw_diagrams,
    hide_until_drawn,
    reveal_diagrams
  } from '@/utils/diagrams'
  import { settled_token } from '@/utils/settled-user'
  import { read_plans } from '@/utils/vault-items'
  import { watch_vault } from '@/utils/vault-events'
  import '@/style/mermaid.css'
  import '#root/tools/publish/renderer/static/scripts/diagrams.css'
  import '#root/tools/publish/renderer/static/plans.css'

  const body = ref(null)

  const plans = ref([])
  const error = ref('')
  const loading = ref(true)
  const params = new URLSearchParams(location.search)
  const chosen = ref(params.get('area') ?? '')
  const chosen_state = ref(params.get('state') ?? '')
  const show_archived = ref(params.has('archived'))

  const areas = computed(() =>
    [
      ...new Set(
        plans.value
          .filter(plan => show_archived.value || !plan.archived)
          .map(plan => plan.area)
      )
    ].sort()
  )
  /** A plan close to done has more behind it than ahead, but work left. */
  const CLOSE_SHARE = 0.75
  /** Enough nodes that the plan carries a lot of work. */
  const MANY_NODES = 10

  const total_of = plan => plan.nodes.open + plan.nodes.done
  const share_done = plan =>
    total_of(plan) ? plan.nodes.done / total_of(plan) : 0

  const states = [
    { value: '', label: 'All' },
    { value: 'none', label: 'No nodes' },
    { value: 'done', label: 'Finished' },
    { value: 'close', label: 'Close to done' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'many', label: 'Many nodes' },
    { value: 'scouts', label: 'Scouts' }
  ]

  const in_state = (plan, state) => {
    if (!state) return true
    if (state === 'none') return total_of(plan) === 0
    if (state === 'done') return total_of(plan) > 0 && plan.nodes.open === 0
    if (state === 'close')
      return plan.nodes.open > 0 && share_done(plan) >= CLOSE_SHARE
    if (state === 'blocked') return plan.nodes.blocked.length > 0
    if (state === 'scouts') return plan.scout === true
    return total_of(plan) >= MANY_NODES
  }

  const keeps = plan =>
    (show_archived.value || !plan.archived) &&
    (!chosen.value || plan.area === chosen.value) &&
    in_state(plan, chosen_state.value)

  /** The old index filters in place; the address still names both filters. */
  const write_filters = () => {
    const params = new URLSearchParams()
    if (chosen.value) params.set('area', chosen.value)
    if (chosen_state.value) params.set('state', chosen_state.value)
    if (show_archived.value) params.set('archived', '')
    const query = params.toString()
    history.replaceState(
      history.state,
      '',
      location.pathname + (query ? `?${query}` : '')
    )
  }

  const choose = area => {
    chosen.value = area
    write_filters()
  }

  const choose_state = state => {
    chosen_state.value = state
    write_filters()
  }

  const toggle_archived = () => {
    show_archived.value = !show_archived.value
    write_filters()
  }

  const token_for = settled_token

  const load = async () => {
    const token = await token_for()
    const response = await fetch('/v1/vault/projects', {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    loading.value = false
    if (!response.ok) {
      error.value = 'Your plans could not load.'
      reveal_diagrams()
      return
    }
    plans.value = read_plans(await response.text())
    if (!plans.value.length) {
      reveal_diagrams()
      return
    }
    await next_tick()
    await draw_diagrams(body.value)
    reveal_diagrams()
  }

  let stop_watching = () => {}

  hide_until_drawn()

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

      nav {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: calc(var(--base-line) * 0.5);
        margin: calc(var(--base-line) * 0.5) 0 0;
        max-inline-size: none;
        padding: 0;
        font-size: 0.75rem;

        a {
          color: var(--accent);
          text-decoration: none;

          &:hover {
            color: var(--emphasis);
          }
        }

        button {
          font: inherit;
          color: inherit;
          background: none;
          border: 1px solid currentColor;
          border-radius: 999px;
          padding: 0.15em 0.7em;
          cursor: pointer;
          opacity: 0.6;

          &[aria-pressed='true'] {
            opacity: 1;
            background: var(--text);
            color: var(--surface);
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
      standard-grid: hi;

      > article {
        display: grid;
        align-content: start;
        min-inline-size: 0;

        &[hidden] {
          display: none;
        }

        > figure > figcaption h3 {
          text-transform: capitalize;
        }

        > dl[aria-label='Nodes'] {
          display: flex;
          flex-wrap: wrap;
          gap: calc(var(--base-line) * 0.5);
          margin: 0;
          color: var(--muted-text);
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          opacity: 0.45;
          text-transform: uppercase;

          dt {
            display: none;
          }

          dd {
            margin: 0;
          }
        }
      }
    }
  }
</style>
