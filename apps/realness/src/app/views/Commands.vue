<template>
  <article
    itemscope
    itemtype="https://schema.org/CollectionPage"
    aria-label="Commands">
    <header aria-label="Commands">
      <nav aria-label="Related">
        <router-link to="/planning">Plans</router-link>
        <router-link to="/planning/tools">Tools</router-link>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <template v-else>
      <search>
        <label for="command-search">Find a command</label>
        <input
          id="command-search"
          v-model="query"
          type="search"
          autocomplete="off"
          aria-controls="command-list" />
        <output aria-live="polite">{{ count_text }}</output>
      </search>
      <fieldset aria-label="Filter by task">
        <legend>Filter by task</legend>
        <button
          v-for="name in group_names"
          :key="name"
          type="button"
          :aria-pressed="String(group === name)"
          @click="group = name">
          {{ name }}
        </button>
      </fieldset>
      <div id="command-list">
        <section v-for="shown_group in shown_groups" :key="shown_group.name">
          <h2>{{ shown_group.name }}</h2>
          <ul>
            <CommandItem
              v-for="command in shown_group.rows"
              :key="command.command"
              :command="command" />
          </ul>
        </section>
      </div>
    </template>
  </article>
</template>

<script setup>
  import { computed, onMounted as on_mounted, ref } from 'vue'
  import CommandItem from '@/components/command/as-item.vue'
  import { current_user } from '@/utils/serverless'

  const groups = ref([])
  const error = ref('')
  const loading = ref(true)
  const query = ref('')
  const group = ref('All')

  const group_names = computed(() => [
    'All',
    ...groups.value.map(entry => entry.name)
  ])

  /** One command's searchable text, the way the page's own filter read it. */
  const haystack = command =>
    [
      command.title,
      command.kind,
      command.review,
      command.note,
      command.command,
      ...command.details
    ]
      .join(' ')
      .toLowerCase()

  const terms = computed(() =>
    query.value.toLowerCase().trim().split(/\s+/).filter(Boolean)
  )

  const shown_groups = computed(() =>
    groups.value
      .filter(entry => group.value === 'All' || entry.name === group.value)
      .map(entry => ({
        name: entry.name,
        rows: entry.rows.filter(command =>
          terms.value.every(term => haystack(command).includes(term))
        )
      }))
      .filter(entry => entry.rows.length)
  )

  const shown_count = computed(() =>
    shown_groups.value.reduce((total, entry) => total + entry.rows.length, 0)
  )

  const count_text = computed(() =>
    shown_count.value
      ? `${shown_count.value} command${shown_count.value === 1 ? '' : 's'}`
      : 'No commands found'
  )

  on_mounted(async () => {
    const token = (await current_user.value?.getIdToken()) ?? null
    const response = await fetch('/v1/vault/commands', {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    loading.value = false
    if (!response.ok) {
      error.value = 'Your commands could not load.'
      return
    }
    const payload = await response.json()
    groups.value = Array.isArray(payload.groups) ? payload.groups : []
  })
</script>

<style lang="stylus">
  article[aria-label='Commands'] {
    max-inline-size: 72rem;
    margin-inline: auto;
    padding-inline: var(--base-line);

    > header[aria-label='Commands'] {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-block: calc(var(--base-line) * 0.5);
    }

    > p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
    }

    > search {
      display: flex;
      align-items: baseline;
      gap: var(--base-line);
      padding-block: var(--base-line);

      input {
        flex: 1;
        font: inherit;
        padding: calc(var(--base-line) * 0.25) calc(var(--base-line) * 0.5);
        background: var(--code-surface);
        border: 1px solid var(--muted-text);
        color: var(--text);
      }

      output {
        color: var(--muted-text);
        font-size: 0.75rem;
        text-transform: uppercase;
      }
    }

    > fieldset {
      display: flex;
      flex-wrap: wrap;
      gap: calc(var(--base-line) * 0.5);
      padding: 0;
      border: 0;

      legend {
        color: var(--muted-text);
        font-size: 0.75rem;
        text-transform: uppercase;
      }

      button {
        font: inherit;
        font-size: 0.75rem;
        padding: calc(var(--base-line) * 0.25) calc(var(--base-line) * 0.5);
        background: none;
        border: 1px solid var(--muted-text);
        color: var(--text);

        &[aria-pressed='true'] {
          border-color: var(--accent);
          color: var(--accent);
        }
      }
    }

    > #command-list {
      padding-block: calc(var(--base-line) * 2);

      section {
        padding-block: var(--base-line);

        h2 {
          margin-block: 0 calc(var(--base-line) * 0.5);
          font-size: 1rem;
        }
      }

      ul {
        display: grid;
        gap: var(--base-line);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        padding: calc(var(--base-line) * 0.5);
        border: 1px solid var(--muted-text);

        header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: var(--base-line);

          h3 {
            margin: 0;
            font-size: 0.875rem;
          }

          span {
            color: var(--muted-text);
            font-size: 0.75rem;
          }
        }

        p {
          margin-block: calc(var(--base-line) * 0.5) 0;
        }

        code {
          background: var(--code-surface);
          padding: 0 0.2em;
        }

        button {
          margin-inline-start: calc(var(--base-line) * 0.5);
          font-size: 0.75rem;
        }

        details {
          margin-block-start: calc(var(--base-line) * 0.5);
        }
      }
    }
  }
</style>
