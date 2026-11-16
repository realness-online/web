<template>
  <article itemscope itemtype="https://schema.org/Dataset" aria-label="Ways in">
    <header aria-label="Ways in">
      <nav aria-label="Related">
        <router-link to="/planning">Plans</router-link>
        <router-link to="/planning/maps/modules">Modules</router-link>
      </nav>
    </header>
    <p v-if="error" role="status">{{ error }}</p>
    <p v-else-if="loading" role="status">Loading</p>
    <template v-else>
      <section aria-label="About">
        <p>{{ data.intro }}</p>
        <details v-if="data.glossary?.length">
          <summary>Glossary</summary>
          <dl>
            <template v-for="entry in data.glossary" :key="entry.term">
              <dt>{{ entry.term }}</dt>
              <dd>{{ entry.detail }}</dd>
            </template>
          </dl>
        </details>
      </section>
      <form aria-label="Filters" @submit.prevent>
        <fieldset>
          <legend>Avatar</legend>
          <label
            v-for="option in [{ id: '', name: 'everyone' }, ...data.avatars]"
            :key="option.id"
            :title="option.kind">
            <input
              v-model="avatar"
              type="radio"
              name="avatar"
              :value="option.id" />
            {{ option.name }}
          </label>
        </fieldset>
        <fieldset>
          <legend>Section</legend>
          <label v-for="name in sections" :key="name">
            <input v-model="shown" type="checkbox" :value="name" />
            {{ name }}
          </label>
        </fieldset>
        <fieldset>
          <legend>Highlight</legend>
          <label
            v-for="option in [{ value: '', label: 'all' }, ...highlights]"
            :key="option.value"
            :data-status="option.value">
            <input v-model="highlight" type="radio" :value="option.value" />
            {{ option.label }}
          </label>
        </fieldset>
        <fieldset>
          <legend>Rows</legend>
          <label>
            <input v-model="open_all" type="checkbox" />
            Open all
          </label>
        </fieldset>
      </form>
      <aside v-if="profile" aria-label="Avatar profile">
        <h2>{{ profile.name }}</h2>
        <p>{{ profile.kind }}. {{ profile.about }}</p>
        <dl>
          <dt>Needs</dt>
          <dd>
            <ul>
              <li v-for="need in profile.needs" :key="need">{{ need }}</li>
            </ul>
          </dd>
          <template v-if="profile.risks.length">
            <dt>Risks</dt>
            <dd>
              <ul>
                <li v-for="risk in profile.risks" :key="risk">{{ risk }}</li>
              </ul>
            </dd>
          </template>
        </dl>
      </aside>
      <dl aria-label="Key">
        <div
          v-for="status in data.statuses"
          :key="status"
          :data-status="status">
          <dt />
          <dd>{{ status === 'none' ? 'not applicable' : status }}</dd>
        </div>
      </dl>
      <table>
        <thead>
          <tr>
            <th>Way in</th>
            <th v-for="[key, label] in data.columns" :key="key">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groups" :key="group.section">
            <tr v-if="group.rows.length" class="section">
              <th :colspan="data.columns.length + 1">{{ group.section }}</th>
            </tr>
            <template v-for="row in group.rows" :key="row.id">
              <tr class="row" :aria-expanded="String(is_open(row))">
                <th>
                  <button type="button" @click="toggle(row)">
                    {{ row.name }}
                  </button>
                  <small>{{ row.sub }}</small>
                </th>
                <td
                  v-for="[key] in data.columns"
                  :key="key"
                  :data-status="cell_of(row, key)[0]"
                  :title="cell_of(row, key)[0]"
                  :class="{ dim: dimmed(key, row) }">
                  {{ cell_of(row, key)[1] }}
                </td>
              </tr>
              <tr v-if="is_open(row)" class="detail">
                <td :colspan="data.columns.length + 1">
                  <ul>
                    <li v-for="(note, index) in row.notes" :key="index">
                      {{ note }}
                    </li>
                  </ul>
                  <p>Avatars: {{ names_of(row) }}</p>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
      <section aria-label="Notes">
        <details>
          <summary>Decisions, patterns, open questions</summary>
          <h2>Decisions so far</h2>
          <ul>
            <li v-for="decision in data.decisions" :key="decision">
              {{ decision }}
            </li>
          </ul>
          <h2>Patterns</h2>
          <ul>
            <li v-for="pattern in data.patterns" :key="pattern">
              {{ pattern }}
            </li>
          </ul>
          <h2>Open questions</h2>
          <ul>
            <li v-for="question in data.questions" :key="question">
              {{ question }}
            </li>
          </ul>
        </details>
      </section>
    </template>
  </article>
</template>

<script setup>
  import { computed, onMounted as on_mounted, reactive, ref, watch } from 'vue'
  import { current_user } from '@/utils/serverless'
  import { read_filters, write_filters } from '@/utils/url-filters'

  const data = ref({
    columns: [],
    avatars: [],
    rows: [],
    patterns: [],
    questions: [],
    statuses: []
  })
  const error = ref('')
  const loading = ref(true)
  const avatar = ref('')
  const shown = ref([])
  const highlight = ref('')
  const open_all = ref(false)
  const toggled = reactive(new Set())

  const sections = computed(() => [
    ...new Set(data.value.rows.map(row => row.section))
  ])

  const highlights = computed(() =>
    data.value.statuses
      .filter(status => status !== 'none')
      .map(status => ({ value: status, label: status }))
  )

  const profile = computed(() =>
    data.value.avatars.find(entry => entry.id === avatar.value)
  )

  const names_of = row =>
    row.avatars
      .map(id => data.value.avatars.find(entry => entry.id === id)?.name ?? id)
      .join(', ')

  const cell_of = (row, key) => row[key] ?? ['none', '-']

  const dimmed = (key, row) =>
    Boolean(highlight.value) && cell_of(row, key)[0] !== highlight.value

  const groups = computed(() =>
    sections.value.map(section => ({
      section,
      rows: data.value.rows.filter(
        row =>
          row.section === section &&
          shown.value.includes(section) &&
          (!avatar.value || row.avatars.includes(avatar.value))
      )
    }))
  )

  const is_open = row => open_all.value !== toggled.has(row.id)

  const toggle = row => {
    if (toggled.has(row.id)) toggled.delete(row.id)
    else toggled.add(row.id)
  }

  on_mounted(async () => {
    const token = (await current_user.value?.getIdToken()) ?? null
    const response = await fetch('/v1/vault/maps?page=ways-in', {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    })
    loading.value = false
    if (!response.ok) {
      error.value = 'Your ways in map could not load.'
      return
    }
    const payload = await response.json()
    if (!payload?.map) {
      error.value = 'Your ways in map could not load.'
      return
    }
    data.value = payload.map
    const saved = read_filters(location.search, [
      'avatar',
      'section',
      'highlight',
      'open'
    ])
    shown.value =
      saved.section === undefined
        ? sections.value
        : saved.section.split(',').filter(name => sections.value.includes(name))
    highlight.value = saved.highlight ?? ''
    open_all.value = saved.open === '1'
    const start = saved.avatar ?? decodeURIComponent(location.hash.slice(1))
    if (data.value.avatars.some(entry => entry.id === start))
      avatar.value = start
    watch([avatar, shown, highlight, open_all], () =>
      write_filters({
        avatar: avatar.value,
        section:
          shown.value.length === sections.value.length
            ? undefined
            : shown.value,
        highlight: highlight.value,
        open: open_all.value
      })
    )
  })
</script>

<style lang="stylus">
  article[itemtype$='/Dataset'] {
    max-inline-size: 90rem;
    margin-inline: auto;
    padding-inline: var(--base-line);

    > header[aria-label] {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-block: calc(var(--base-line) * 0.5);
    }

    > p[role='status'] {
      padding-block: calc(var(--base-line) * 3);
      text-align: center;
    }

    > form {
      display: flex;
      flex-wrap: wrap;
      gap: var(--base-line);
      padding-block: var(--base-line);

      fieldset {
        display: flex;
        flex-wrap: wrap;
        gap: calc(var(--base-line) * 0.4);
        margin: 0;
        padding: 0;
        border: 0;
        font-size: 0.75rem;

        legend {
          color: var(--muted-text);
          text-transform: uppercase;
        }

        label {
          border: 1px solid var(--muted-text);
          padding: 0.15em 0.4em;

          &:has(input:checked) {
            border-color: var(--accent);
            color: var(--accent);
          }

          input {
            inline-size: 0;
            block-size: 0;
            margin: 0;
            opacity: 0;
          }
        }
      }
    }

    > dl[aria-label='Key'] {
      display: flex;
      flex-wrap: wrap;
      gap: calc(var(--base-line) * 0.5);
      font-size: 0.75rem;

      div {
        display: flex;
        gap: 0.3em;
      }

      dt {
        inline-size: 0.8em;
        block-size: 0.8em;
        align-self: center;
        border: 1px solid var(--muted-text);
      }

      dd {
        margin: 0;
        color: var(--muted-text);
      }
    }

    > aside[aria-label='Avatar profile'] {
      padding-block: var(--base-line);
      max-inline-size: 65ch;

      h2 {
        margin-block: 0 calc(var(--base-line) * 0.5);
        font-size: 1rem;
      }

      dt {
        font-weight: 700;
      }

      dd {
        margin-inline-start: 0;
      }
    }

    > table {
      inline-size: 100%;
      margin-block: var(--base-line);
      border-collapse: collapse;
      font-size: 0.8125rem;
      line-height: 1.4;
      text-align: start;

      th,
      td {
        padding: 0.4em 0.5em;
        border-block-end: 1px solid var(--muted-text);
        text-align: start;
        vertical-align: top;
      }

      thead th {
        color: var(--muted-text);
        font-size: 0.75rem;
        text-transform: uppercase;
      }

      tr.section th {
        padding-block-start: var(--base-line);
        font-weight: 800;
      }

      tr.row > th {
        font-weight: 400;

        button {
          display: block;
          font: inherit;
          font-weight: 700;
          padding: 0;
          background: none;
          border: 0;
          color: var(--text);
          text-align: start;
        }

        small {
          color: var(--muted-text);
          font-size: 0.75rem;
        }
      }

      td.dim {
        opacity: 0.25;
      }

      .tag {
        display: inline-block;
        margin-inline-end: 0.25em;
        color: var(--muted-text);
        font-size: 0.7rem;
      }

      td.fate[data-fate='keep'] {
        color: var(--accent);
      }

      td.fate[data-fate='merge'],
      td[data-status='gap'] {
        color: var(--emphasis);
      }

      td[data-status='broken'] {
        font-weight: 700;
      }
    }

    > section[aria-label='Notes'] {
      padding-block: calc(var(--base-line) * 2);
      max-inline-size: 65ch;
    }
  }
</style>
