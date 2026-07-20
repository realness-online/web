/** @fileoverview Sync folder - mirror thoughts to a user-selected directory. */

/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Thought} Thought */
/** @typedef {import('@/types').Statement} Statement */

import {
  createApp,
  h,
  inject,
  nextTick as tick,
  ref,
  onMounted as mounted,
  onUnmounted as dismount,
  watch
} from 'vue'
import { get, set, keys } from 'idb-keyval'
import PosterAsFigure from '@/components/posters/as-figure'
import {
  as_directory,
  build_local_directory,
  load_directory_from_network
} from '@/persistence/Directory'
import {
  build_download_svg,
  revalidate_poster_files,
  wait_for_poster_export_ready
} from '@/utils/export-poster'
import {
  as_query_id,
  as_created_at,
  list,
  as_author,
  load,
  load_from_network,
  type_as_list
} from '@/utils/itemid'
import { thoughts_for_author } from '@/utils/thoughts'
import {
  thought_folder_name,
  poster_file_name
} from '@/utils/folder-sync-paths'
import { sync_folder as sync_folder_pref, sync_svg } from '@/utils/preference'
import { mutex_for } from '@/utils/algorithms'

export const sync_folder_supported = () =>
  'showDirectoryPicker' in window && 'FileSystemFileHandle' in window

/** Brave disables the File System Access API by default; it exposes
 *  `navigator.brave` for feature detection specifically so sites don't have
 *  to fingerprint-sniff for it. */
export const detect_brave = async () => {
  const brave = /** @type {any} */ (globalThis.navigator)?.brave
  if (!brave) return false
  try {
    return await brave.isBrave()
  } catch {
    return false
  }
}

const SYNC_FOLDER_HANDLE_KEY = 'sync_folder_handle'
const SYNC_FOLDER_QUEUE_KEY = 'sync:folder-queue'
const SYNC_FOLDER_MANIFEST_KEY = 'sync:folder-manifest'
const SVG_WAIT_TIMEOUT_MS = 30000
const DRAIN_DEBOUNCE_MS = 400
/** Newest-first history walk: this many thoughts per pass. */
const HISTORY_BATCH_SIZE = 20
/** Concurrent off-screen poster exports. */
const PARALLEL_EXPORTS = 3
/** Pause before chaining the next older batch. */
const HISTORY_BATCH_PAUSE_MS = 2000

/** @type {ReturnType<typeof ref<'idle' | 'syncing' | 'needs_permission' | 'error'>>} */
export const folder_sync_status = ref('idle')
/** @type {ReturnType<typeof ref<string>>} */
export const folder_sync_name = ref('')
/** @type {ReturnType<typeof ref<string | null>>} */
export const folder_sync_last_at = ref(null)
/** @type {ReturnType<typeof ref<string | null>>} */
export const folder_sync_error = ref(null)
/**
 * Live progress while syncing.
 * @type {ReturnType<typeof ref<{
 *   current: number
 *   total: number
 *   label: string
 *   detail: string
 * }>>}
 */
export const folder_sync_progress = ref({
  current: 0,
  total: 0,
  label: '',
  detail: ''
})

const clear_folder_sync_progress = () => {
  folder_sync_progress.value = {
    current: 0,
    total: 0,
    label: '',
    detail: ''
  }
}

/**
 * @param {Partial<{ current: number, total: number, label: string, detail: string }>} patch
 */
const set_folder_sync_progress = patch => {
  const prev = folder_sync_progress.value ?? {
    current: 0,
    total: 0,
    label: '',
    detail: ''
  }
  folder_sync_progress.value = {
    current: patch.current ?? prev.current,
    total: patch.total ?? prev.total,
    label: patch.label ?? prev.label,
    detail: patch.detail ?? prev.detail
  }
}

/** @type {ReturnType<typeof setTimeout> | null} */
let drain_timer = null
/** @type {Promise<void> | null} */
let drain_inflight = null

/**
 * @typedef {{
 *   cancelled: boolean
 *   created_paths: Set<string>
 *   writing_paths: Set<string>
 *   on_cancel: Set<() => void>
 * }} Folder_Sync_Run
 */

/** @type {Folder_Sync_Run | null} */
let active_run = null

const folder_sync_cancelled_error = () => {
  const error = new Error('folder-sync-cancelled')
  error.name = 'FolderSyncCancelled'
  return error
}

/**
 * @param {Folder_Sync_Run} run
 */
const assert_run_active = run => {
  if (run.cancelled || !sync_folder_pref.value)
    throw folder_sync_cancelled_error()
}

/**
 * Stop an in-flight sync and drop pending drains. Incomplete folders from the
 * aborted run are cleaned in `run_folder_sync`'s cancel path.
 */
export const cancel_folder_sync = () => {
  if (drain_timer) {
    clearTimeout(drain_timer)
    drain_timer = null
  }
  if (active_run) {
    active_run.cancelled = true
    for (const on_cancel of active_run.on_cancel) on_cancel()
    active_run.on_cancel.clear()
  }
}

/** Thoughts that failed to fully write this session. The batch walker skips
 *  them so the history chain can finish; a user-triggered sync retries them. */
const failed_thoughts = new Set()
export const clear_failed_thoughts = () => failed_thoughts.clear()

/**
 * @param {FileSystemDirectoryHandle} root
 * @param {Folder_Sync_Run} run
 */
const clean_aborted_run = async (root, run) => {
  const paths = new Set([...run.created_paths, ...run.writing_paths])
  for (const path of paths)
    try {
      await root.removeEntry(path, { recursive: true })
    } catch {
      /* ignore */
    }
}

/**
 * Mount the poster off-screen and resolve with its `<svg>` once the figure
 * emits `show` — event-driven, no polling, so it settles (or times out) even
 * in a backgrounded tab. Rejects on `missing`, cancel, or timeout. The caller
 * unmounts the returned app.
 * @param {Id} itemid
 * @param {HTMLElement} container
 * @param {Folder_Sync_Run} run
 * @returns {{ app: import('vue').App, shown: Promise<SVGSVGElement> }}
 */
const mount_poster_until_shown = (itemid, container, run) => {
  /** @type {(svg: SVGSVGElement) => void} */
  let resolve
  /** @type {(error: Error) => void} */
  let reject
  /** @type {Promise<SVGSVGElement>} */
  const shown = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  let settled = false
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null
  /**
   * @param {Error | null} error
   * @param {SVGSVGElement} [svg]
   */
  const finish = (error, svg) => {
    if (settled) return
    settled = true
    if (timer) clearTimeout(timer)
    run.on_cancel.delete(on_cancel)
    if (error) reject(error)
    else resolve(/** @type {SVGSVGElement} */ (svg))
  }
  const on_cancel = () => finish(folder_sync_cancelled_error())
  run.on_cancel.add(on_cancel)
  timer = setTimeout(
    () => finish(new Error(`Timeout waiting for poster: ${itemid}`)),
    SVG_WAIT_TIMEOUT_MS
  )
  const app = createApp({
    name: 'SyncFolderPoster',
    render: () =>
      h(PosterAsFigure, {
        itemid,
        menu: false,
        /** Off-screen mount never intersects the viewport; pin forces cutout symbols to load. */
        pin: true,
        onShow: async () => {
          await tick()
          const svg = document.getElementById(as_query_id(itemid))
          if (svg instanceof SVGSVGElement) finish(null, svg)
          else finish(new Error(`Poster SVG missing after show: ${itemid}`))
        },
        onMissing: () => finish(new Error(`Poster reported missing: ${itemid}`))
      })
  })
  app.provide('set_working', () => {})
  // Bare app has no router — stub router-link so the figure renders quietly
  app.component('router-link', (_props, { slots }) => h('a', slots.default?.()))
  app.mount(container)
  return { app, shown }
}

/**
 * @param {FileSystemDirectoryHandle} dir_handle
 * @param {string} filename
 * @param {Blob} blob
 */
const write_file = async (dir_handle, filename, blob) => {
  const file_handle = await dir_handle.getFileHandle(filename, { create: true })
  const writable = await file_handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

/**
 * @param {unknown} handle
 * @returns {Promise<boolean>}
 */
export const ensure_folder_permission = async handle => {
  if (!handle || typeof handle !== 'object') return false
  const opts = { mode: 'readwrite' }
  const dir = /** @type {FileSystemDirectoryHandle & {
    queryPermission?: (o: object) => Promise<PermissionState>
    requestPermission?: (o: object) => Promise<PermissionState>
  }} */ (handle)
  if (typeof dir.queryPermission === 'function') {
    const state = await dir.queryPermission(opts)
    if (state === 'granted') return true
  }
  if (typeof dir.requestPermission === 'function') {
    const state = await dir.requestPermission(opts)
    return state === 'granted'
  }
  return true
}

/**
 * @returns {Promise<FileSystemDirectoryHandle | null>}
 */
export const get_sync_folder_handle = async () => {
  const handle = await get(SYNC_FOLDER_HANDLE_KEY)
  return handle ?? null
}

/**
 * @param {Thought} thought
 * @returns {string}
 */
const thought_content_key = thought => {
  const poster_ids = thought.posters.map(p => p.id).join(',')
  const texts = thought.statements
    .map(s => `${s.id}:${s.statement ?? ''}`)
    .join('|')
  return `${thought.started_at}|svg:${sync_svg.value}|${poster_ids}|${texts}`
}

/**
 * @param {Statement[]} statements
 * @returns {string}
 */
const notes_markdown = statements => {
  const body = statements
    .map(statement => {
      const created = as_created_at(statement.id)
      return [
        '---',
        `id: ${statement.id}`,
        `created: ${created ? new Date(created).toISOString() : ''}`,
        '---',
        '',
        statement.statement ?? '',
        ''
      ].join('\n')
    })
    .join('\n')
  return body
}

/**
 * Scan IndexedDB for poster item keys for this author.
 * @param {Id} me
 * @returns {Promise<Set<number>>}
 */
const scan_poster_keys = async me => {
  const prefix = `${me}/posters/`
  /** @type {Set<number>} */
  const created = new Set()
  const everything = await keys()
  for (const key of everything) {
    if (typeof key !== 'string') continue
    if (!key.startsWith(prefix)) continue
    if (key.endsWith('/')) continue
    const parts = key.split('/').filter(Boolean)
    // ['+1…', 'posters', '123'] — skip directory-only keys
    if (parts.length !== 3 || parts[1] !== 'posters') continue
    const id = as_created_at(/** @type {Id} */ (key))
    if (id) created.add(id)
  }
  return created
}

/**
 * @param {Id} me
 * @returns {Promise<Item[]>}
 */
const gather_poster_items = async me => {
  const root = /** @type {Id} */ (`${me}/posters/`)
  const scanned = await scan_poster_keys(me)
  const local = await build_local_directory(root)
  let directory = await as_directory(root)

  /** @type {Set<number | string>} */
  const created = new Set([
    ...scanned,
    ...(local?.items ?? []),
    ...(directory?.items ?? [])
  ])

  console.info('[sync-folder] posters inventory', {
    me,
    scanned: scanned.size,
    local_items: local?.items?.length ?? 0,
    directory_items: directory?.items?.length ?? 0,
    archives: directory?.archive?.length ?? 0,
    online: navigator.onLine
  })

  // Stale empty directory cache skips network in as_directory — force a fetch.
  if (created.size === 0 && navigator.onLine) {
    console.info('[sync-folder] forcing network posters directory')
    try {
      const network = await load_directory_from_network(root)
      directory = network ?? directory
      for (const item of network?.items ?? []) created.add(item)
      console.info('[sync-folder] network posters', {
        items: network?.items?.length ?? 0,
        archives: network?.archive?.length ?? 0
      })
    } catch (error) {
      console.warn('[sync-folder] network posters failed', error)
    }
  }

  for (const archive_id of directory?.archive ?? []) {
    const author = as_author(root)
    if (!author) continue
    const archive_path = /** @type {Id} */ (
      `/${author.slice(1)}/posters/${archive_id}/`
    )
    let archive_dir = await as_directory(archive_path)
    if (!archive_dir?.items?.length && navigator.onLine)
      try {
        archive_dir =
          (await load_directory_from_network(archive_path)) ?? archive_dir
      } catch (error) {
        console.warn('[sync-folder] archive load failed', archive_id, error)
      }
    console.info('[sync-folder] posters archive', {
      archive_id,
      items: archive_dir?.items?.length ?? 0
    })
    for (const item of archive_dir?.items ?? []) created.add(item)
  }

  const items = [...created].map(c => /** @type {Item} */ ({
    id: /** @type {Id} */ (`${me}/posters/${c}`),
    type: 'posters'
  }))
  console.info('[sync-folder] poster items gathered', items.length)
  return items
}

/**
 * Load statements the same way the feed does (page + legacy thoughts + stray keys).
 * @param {Id} me
 * @returns {Promise<Item[]>}
 */
const gather_statements = async me => {
  const statements_id = /** @type {Id} */ (`${me}/statements`)
  let statements = await list(statements_id)
  console.info('[sync-folder] statements page', {
    statements_id,
    count: statements.length,
    has_localStorage: Boolean(
      typeof localStorage !== 'undefined' && localStorage.getItem(statements_id)
    )
  })

  if (!statements.length && navigator.onLine)
    try {
      console.info('[sync-folder] forcing network statements page')
      const from_network = await load_from_network(statements_id)
      if (from_network) {
        statements = type_as_list(from_network)
        console.info('[sync-folder] network statements', statements.length)
      }
    } catch (error) {
      console.warn('[sync-folder] network statements failed', error)
    }

  if (!statements.length) {
    const legacy = await list(/** @type {Id} */ (`${me}/thoughts`))
    console.info('[sync-folder] legacy thoughts page', legacy.length)
    if (legacy.length)
      statements = legacy.map(item => {
        const legacy_item =
          /** @type {Item & { thought?: string, statement?: string }} */ (item)
        return /** @type {Item} */ ({
          ...legacy_item,
          id: /** @type {Id} */ (
            String(legacy_item.id).replace('/thoughts/', '/statements/')
          ),
          statement: legacy_item.statement ?? legacy_item.thought ?? ''
        })
      })
  }
  if (statements.length || typeof localStorage === 'undefined') {
    console.info('[sync-folder] statements gathered', statements.length)
    return statements
  }

  const prefix = `${me}/statements/`
  /** @type {Item[]} */
  const found = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(prefix)) continue
    const item = await load(/** @type {Id} */ (key))
    if (item) found.push(item)
  }
  console.info('[sync-folder] statements from individual keys', found.length)
  return found
}

/**
 * @param {Id} me
 * @returns {Promise<Thought[]>}
 */
const gather_thoughts = async me => {
  const poster_items = await gather_poster_items(me)
  const statements = await gather_statements(me)
  const thoughts = thoughts_for_author([...poster_items, ...statements])
  console.info('[sync-folder] thoughts_for_author', {
    posters: poster_items.length,
    statements: statements.length,
    thoughts: thoughts.length,
    sample: thoughts.slice(0, 3).map(t => ({
      started_at: t.started_at,
      posters: t.posters.length,
      statements: t.statements.length
    }))
  })
  return thoughts
}

/**
 * Newest first. Each pass: refresh the 20 most recent if needed, then fill with
 * never-synced thoughts walking older (still newest-first among unsynced).
 * @param {Thought[]} thoughts
 * @param {Record<string, { path: string, key: string }>} manifest_thoughts
 * @returns {{ batch: Thought[], remaining_unsynced: number, library_total: number }}
 */
const select_history_batch = (thoughts, manifest_thoughts) => {
  const sorted = [...thoughts].sort((a, b) => b.started_at - a.started_at)
  const needs_write = thought => {
    const prior = manifest_thoughts[String(thought.started_at)]
    if (!prior) return true
    return prior.key !== thought_content_key(thought)
  }

  /** @type {Thought[]} */
  const batch = []
  const seen = new Set()

  // Always reconsider the live head (20 most recent)
  for (const thought of sorted.slice(0, HISTORY_BATCH_SIZE)) {
    if (failed_thoughts.has(String(thought.started_at))) continue
    if (!needs_write(thought)) continue
    batch.push(thought)
    seen.add(thought.started_at)
  }

  // Walk older unsynced, newest first, until the batch is full
  for (const thought of sorted) {
    if (batch.length >= HISTORY_BATCH_SIZE) break
    if (seen.has(thought.started_at)) continue
    if (failed_thoughts.has(String(thought.started_at))) continue
    if (manifest_thoughts[String(thought.started_at)]) continue
    batch.push(thought)
    seen.add(thought.started_at)
  }

  const remaining_unsynced = sorted.filter(
    thought =>
      !manifest_thoughts[String(thought.started_at)] &&
      !seen.has(thought.started_at) &&
      !failed_thoughts.has(String(thought.started_at))
  ).length

  return { batch, remaining_unsynced, library_total: sorted.length }
}

/**
 * @param {number} remaining_unsynced
 * @param {{ set_working?: (v: boolean) => void }} [opts]
 */
const schedule_history_continuation = (remaining_unsynced, opts = {}) => {
  if (remaining_unsynced <= 0) return
  if (!sync_folder_pref.value) return
  if (drain_timer) clearTimeout(drain_timer)
  set_folder_sync_progress({
    current: 0,
    total: remaining_unsynced,
    label: '',
    detail: `Next ${Math.min(HISTORY_BATCH_SIZE, remaining_unsynced)} older thoughts soon…`
  })
  drain_timer = setTimeout(() => {
    drain_timer = null
    if (!sync_folder_pref.value) return
    void drain_folder_queue({ force: true, set_working: opts.set_working })
  }, HISTORY_BATCH_PAUSE_MS)
}

/**
 * @typedef {object} Thought_Sync_Session
 * @property {FileSystemDirectoryHandle} root
 * @property {Record<string, { path: string, key: string }>} manifest_thoughts
 * @property {Folder_Sync_Run} run
 * @property {Set<string>} prior_paths
 */

/**
 * @param {Thought_Sync_Session} session
 * @param {Thought} thought
 * @param {HTMLElement} container
 * @param {{ index: number, total: number }} progress
 */
const sync_one_thought = async (session, thought, container, progress) => {
  const { root, manifest_thoughts, run, prior_paths } = session
  assert_run_active(run)
  const key = thought_content_key(thought)
  const path = thought_folder_name(thought)
  const started_key = String(thought.started_at)
  const prior = manifest_thoughts[started_key]

  set_folder_sync_progress({
    current: progress.index,
    total: progress.total,
    label: path,
    detail:
      prior?.key === key && prior.path === path
        ? 'Unchanged'
        : 'Writing thought'
  })

  if (prior?.key === key && prior.path === path) return

  if (prior?.path && prior.path !== path)
    try {
      await root.removeEntry(prior.path, { recursive: true })
    } catch {
      /* prior folder may already be gone */
    }

  const posters = sync_svg.value ? thought.posters : []
  if (!posters.length && !thought.statements.length) {
    if (prior?.path)
      try {
        await root.removeEntry(prior.path, { recursive: true })
      } catch {
        /* ignore */
      }
    delete manifest_thoughts[started_key]
    return
  }

  run.writing_paths.add(path)
  if (!prior_paths.has(path)) run.created_paths.add(path)

  const thought_dir = await root.getDirectoryHandle(path, { create: true })
  assert_run_active(run)

  if (thought.statements.length) {
    set_folder_sync_progress({ detail: 'Writing notes.md' })
    const blob = new Blob([notes_markdown(thought.statements)], {
      type: 'text/markdown'
    })
    await write_file(thought_dir, 'notes.md', blob)
    assert_run_active(run)
  }

  const poster_total = posters.length
  let skipped = 0
  /* oxlint-disable no-await-in-loop -- sequential: mount → export → unmount per poster */
  for (let poster_index = 0; poster_index < posters.length; poster_index++) {
    assert_run_active(run)
    const poster = posters[poster_index]
    const itemid = /** @type {Id} */ (poster.id)
    const filename = poster_file_name(itemid)
    set_folder_sync_progress({
      detail:
        poster_total > 1
          ? `Poster ${poster_index + 1} of ${poster_total}`
          : 'Rendering poster'
    })
    // Poster files are content-stable per id — resume a partially synced
    // thought without re-rendering what is already on disk.
    let already_written = false
    try {
      await thought_dir.getFileHandle(filename)
      already_written = true
    } catch {
      /* not on disk yet */
    }
    if (already_written) continue
    // Only export posters we can confirm: clear stale negative-cache rows so
    // loads re-verify against the server, then require the poster itself to
    // load before paying for a mount and export wait.
    await revalidate_poster_files(itemid)
    const confirmed = await load(itemid)
    if (!confirmed) {
      console.warn('[sync-folder] poster unavailable; skipping', itemid)
      set_folder_sync_progress({ detail: `Missing ${filename}` })
      skipped++
      continue
    }
    const { app, shown } = mount_poster_until_shown(itemid, container, run)

    try {
      set_folder_sync_progress({ detail: `Waiting for ${filename}` })
      const svg = await shown
      assert_run_active(run)
      await wait_for_poster_export_ready(svg, itemid)
      assert_run_active(run)
      set_folder_sync_progress({ detail: `Writing ${filename}` })
      // Same path download-vector uses once the live SVG is ready
      const download_svg = build_download_svg(svg)
      const svg_string = new XMLSerializer().serializeToString(download_svg)
      const blob = new Blob([svg_string], { type: 'image/svg+xml' })
      await write_file(thought_dir, filename, blob)
    } catch (error) {
      if (error instanceof Error && error.name === 'FolderSyncCancelled')
        throw error
      console.error('[sync-folder] skipped poster', itemid, error)
      set_folder_sync_progress({ detail: `Skipped ${filename}` })
      skipped++
    } finally {
      app.unmount()
    }
  }
  /* oxlint-enable no-await-in-loop */

  // A skipped poster means the folder is incomplete — leave it out of the
  // manifest so a later run retries instead of reporting "Up to date", but
  // mark it failed so the automatic history chain stops re-attempting it.
  if (skipped === 0) manifest_thoughts[started_key] = { path, key }
  else {
    delete manifest_thoughts[started_key]
    failed_thoughts.add(started_key)
  }
  run.writing_paths.delete(path)
}

/**
 * @param {FileSystemDirectoryHandle} root
 * @param {{ path: string }} entry
 * @param {Thought | undefined} thought
 * @returns {Promise<boolean>}
 */
const entry_on_disk = async (root, entry, thought) => {
  try {
    const dir = await root.getDirectoryHandle(entry.path)
    if (!thought) return true
    const posters = sync_svg.value ? thought.posters : []
    /* oxlint-disable no-await-in-loop -- sequential handle probes */
    for (const poster of posters)
      await dir.getFileHandle(poster_file_name(/** @type {Id} */ (poster.id)))
    /* oxlint-enable no-await-in-loop */
    if (thought.statements.length) await dir.getFileHandle('notes.md')
    return true
  } catch {
    return false
  }
}

/**
 * Drop manifest entries whose files are missing on disk so they re-sync.
 * Heals a stale manifest after a switched folder, emptied folder, or a
 * previous run that failed part-way.
 * @param {FileSystemDirectoryHandle} root
 * @param {Record<string, { path: string, key: string }>} manifest_thoughts
 * @param {Thought[]} thoughts
 */
const validate_manifest_on_disk = async (root, manifest_thoughts, thoughts) => {
  const by_start = new Map(thoughts.map(t => [String(t.started_at), t]))
  let dropped = 0
  /* oxlint-disable no-await-in-loop -- sequential handle probes */
  for (const [started_key, entry] of Object.entries(manifest_thoughts)) {
    const ok = await entry_on_disk(root, entry, by_start.get(started_key))
    if (ok) continue
    delete manifest_thoughts[started_key]
    dropped++
  }
  /* oxlint-enable no-await-in-loop */
  if (dropped)
    console.info('[sync-folder] manifest entries missing on disk', dropped)
}

/**
 * @param {FileSystemDirectoryHandle} root
 * @param {Record<string, { path: string, key: string }>} manifest_thoughts
 * @param {Set<string>} keep
 */
const remove_orphan_thoughts = async (root, manifest_thoughts, keep) => {
  for (const started_key of Object.keys(manifest_thoughts)) {
    if (keep.has(started_key)) continue
    const path = manifest_thoughts[started_key]?.path
    if (path)
      try {
        await root.removeEntry(path, { recursive: true })
      } catch {
        /* ignore */
      }
    delete manifest_thoughts[started_key]
  }
}

/**
 * Full mirror reconcile of the library into the sync folder.
 * @param {{ set_working?: (v: boolean) => void }} [opts]
 * @returns {Promise<boolean>}
 */
export const run_folder_sync = async (opts = {}) => {
  console.info('[sync-folder] run start', {
    pref: sync_folder_pref.value,
    sync_svg: sync_svg.value,
    me: localStorage.me ?? null
  })
  if (!sync_folder_pref.value) {
    console.warn('[sync-folder] abort: sync_folder preference is off')
    return false
  }
  const { me } = localStorage
  if (!me) {
    console.warn('[sync-folder] abort: localStorage.me missing')
    return false
  }

  const handle = await get_sync_folder_handle()
  if (!handle) {
    console.warn('[sync-folder] abort: no folder handle')
    folder_sync_status.value = 'needs_permission'
    return false
  }
  console.info('[sync-folder] folder handle', {
    name: /** @type {{ name?: string }} */ (handle).name
  })

  const allowed = await ensure_folder_permission(handle)
  if (!allowed) {
    console.warn('[sync-folder] abort: folder permission denied')
    folder_sync_status.value = 'needs_permission'
    return false
  }

  const run = {
    cancelled: false,
    created_paths: /** @type {Set<string>} */ (new Set()),
    writing_paths: /** @type {Set<string>} */ (new Set()),
    on_cancel: /** @type {Set<() => void>} */ (new Set())
  }
  active_run = run

  folder_sync_status.value = 'syncing'
  folder_sync_error.value = null
  set_folder_sync_progress({
    current: 0,
    total: 0,
    label: '',
    detail: 'Gathering thoughts'
  })
  opts.set_working?.(true)

  const containers = Array.from({ length: PARALLEL_EXPORTS }, () => {
    const container = document.createElement('div')
    // Real size so content-visibility / layout still produce SVG geometry
    container.style.cssText =
      'position:fixed;left:-9999px;top:0;width:24rem;height:36rem;overflow:hidden;visibility:hidden'
    document.body.appendChild(container)
    return container
  })

  const root = /** @type {FileSystemDirectoryHandle} */ (handle)
  const mutex = mutex_for('sync:folder')
  await mutex.lock()
  try {
    assert_run_active(run)
    const thoughts = await gather_thoughts(/** @type {Id} */ (me))
    /** @type {{ thoughts?: Record<string, { path: string, key: string }>, last_synced_at?: string }} */
    const manifest = (await get(SYNC_FOLDER_MANIFEST_KEY)) || { thoughts: {} }
    const manifest_thoughts = { ...manifest.thoughts }
    console.info('[sync-folder] manifest', {
      entries: Object.keys(manifest_thoughts).length,
      last_synced_at: manifest.last_synced_at ?? null
    })
    await validate_manifest_on_disk(root, manifest_thoughts, thoughts)
    const prior_paths = new Set(
      Object.values(manifest_thoughts).map(entry => entry.path)
    )
    // Keep every library thought — never orphan folders we simply have not
    // walked back to yet.
    const keep = new Set(thoughts.map(t => String(t.started_at)))
    const { batch, remaining_unsynced, library_total } = select_history_batch(
      thoughts,
      manifest_thoughts
    )
    console.info('[sync-folder] batch selected', {
      batch: batch.length,
      library_total,
      remaining_unsynced,
      batch_starts: batch.map(t => t.started_at)
    })
    const total = batch.length
    const batch_detail = () => {
      if (total)
        return `Batch of ${total} (${library_total} in library, ${remaining_unsynced} older waiting)`
      return library_total ? 'Up to date' : 'Nothing to sync'
    }
    set_folder_sync_progress({ current: 0, total, detail: batch_detail() })

    // Worker pool: each worker owns one off-screen container so layer loads
    // overlap instead of queueing behind one poster at a time.
    /** @type {Thought_Sync_Session} */
    const session = { root, manifest_thoughts, run, prior_paths }
    let next_index = 0
    let completed = 0
    const worker = async container => {
      /* oxlint-disable no-await-in-loop -- each worker exports sequentially */
      try {
        while (next_index < batch.length) {
          const i = next_index++
          assert_run_active(run)
          console.info('[sync-folder] sync thought', {
            index: i + 1,
            total,
            started_at: batch[i].started_at,
            posters: batch[i].posters.length,
            statements: batch[i].statements.length
          })
          await sync_one_thought(session, batch[i], container, {
            index: ++completed,
            total
          })
        }
      } catch (error) {
        // Stop the other workers at their next checkpoint, then let
        // allSettled below surface the original error once all are done.
        run.cancelled = true
        throw error
      }
      /* oxlint-enable no-await-in-loop */
    }
    const settled = await Promise.allSettled(
      containers.slice(0, Math.max(1, batch.length)).map(worker)
    )
    const failures = settled
      .filter(result => result.status === 'rejected')
      .map(result => /** @type {PromiseRejectedResult} */ (result).reason)
    const real_failure = failures.find(
      error => !(error instanceof Error && error.name === 'FolderSyncCancelled')
    )
    if (real_failure) throw real_failure
    if (failures.length) throw failures[0]

    assert_run_active(run)
    set_folder_sync_progress({
      current: total,
      total,
      label: '',
      detail: 'Cleaning up orphans'
    })
    await remove_orphan_thoughts(root, manifest_thoughts, keep)
    assert_run_active(run)

    const last_synced_at = new Date().toISOString()
    await set(SYNC_FOLDER_MANIFEST_KEY, {
      thoughts: manifest_thoughts,
      last_synced_at
    })
    folder_sync_last_at.value = last_synced_at
    folder_sync_name.value = handle.name ?? folder_sync_name.value
    console.info('[sync-folder] run complete', {
      wrote: total,
      remaining_unsynced,
      manifest_entries: Object.keys(manifest_thoughts).length
    })

    if (remaining_unsynced > 0) {
      folder_sync_status.value = 'syncing'
      schedule_history_continuation(remaining_unsynced, opts)
    } else folder_sync_status.value = 'idle'

    return true
  } catch (error) {
    if (error instanceof Error && error.name === 'FolderSyncCancelled') {
      console.info('[sync-folder] cancelled')
      await clean_aborted_run(root, run)
      folder_sync_status.value = 'idle'
      folder_sync_error.value = null
      return false
    }
    console.error('[sync-folder] run failed', error)
    folder_sync_status.value = 'error'
    folder_sync_error.value =
      error instanceof Error ? error.message : String(error)
    return false
  } finally {
    for (const container of containers) container.remove()
    opts.set_working?.(false)
    // Keep progress visible while waiting for the next history batch
    if (!drain_timer) clear_folder_sync_progress()
    if (active_run === run) active_run = null
    mutex.unlock()
  }
}

/**
 * Queue an item change for folder sync (persistence Folder mixin entry).
 * @param {Id} id
 * @param {'save' | 'delete'} [action]
 */
export const enqueue_folder_sync = async (id, action = 'save') => {
  if (!sync_folder_pref.value) return
  const mutex = mutex_for('sync:folder-queue')
  await mutex.lock()
  try {
    /** @type {{ id: Id, action: string }[]} */
    const queue = (await get(SYNC_FOLDER_QUEUE_KEY)) || []
    const exists = queue.some(item => item.id === id && item.action === action)
    if (!exists) {
      queue.push({ id, action })
      await set(SYNC_FOLDER_QUEUE_KEY, queue)
    }
  } finally {
    mutex.unlock()
  }
  schedule_folder_drain()
}

const schedule_folder_drain = () => {
  if (drain_timer) clearTimeout(drain_timer)
  drain_timer = setTimeout(() => {
    drain_timer = null
    void drain_folder_queue()
  }, DRAIN_DEBOUNCE_MS)
}

/**
 * Drain the folder queue by running a full mirror reconcile.
 * @param {{ set_working?: (v: boolean) => void, force?: boolean }} [opts]
 */
export const drain_folder_queue = async (opts = {}) => {
  if (drain_inflight) {
    console.info('[sync-folder] drain already in flight; joining')
    return drain_inflight
  }
  drain_inflight = (async () => {
    const mutex = mutex_for('sync:folder-queue')
    await mutex.lock()
    /** @type {{ id: Id, action: string }[]} */
    let queue = []
    try {
      queue = (await get(SYNC_FOLDER_QUEUE_KEY)) || []
      await set(SYNC_FOLDER_QUEUE_KEY, [])
    } finally {
      mutex.unlock()
    }

    console.info('[sync-folder] drain', {
      queue: queue.length,
      force: Boolean(opts.force),
      pref: sync_folder_pref.value
    })
    if (!queue.length && !opts.force) {
      console.info('[sync-folder] drain skip: empty queue')
      return
    }
    if (!sync_folder_pref.value) {
      console.warn('[sync-folder] drain skip: preference off')
      return
    }
    const handle = await get_sync_folder_handle()
    if (!handle) {
      console.warn('[sync-folder] drain skip: no folder handle')
      folder_sync_status.value = 'needs_permission'
      return
    }
    await run_folder_sync(opts)
  })()
  try {
    await drain_inflight
  } finally {
    drain_inflight = null
  }
}

/**
 * Wait for any in-flight drain to settle (including after cancel).
 * @returns {Promise<void>}
 */
export const await_folder_sync_idle = async () => {
  if (drain_inflight) await drain_inflight
}

/**
 * @returns {Promise<FileSystemDirectoryHandle | null>}
 */
export const choose_sync_folder = async () => {
  const dir = await /** @type {any} */ (window).showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'documents',
    id: 'sync-folder'
  })
  await set(SYNC_FOLDER_HANDLE_KEY, dir)
  folder_sync_name.value = dir.name
  return dir
}

export const use = () => {
  const set_working = inject('set_working', undefined)

  const refresh_name = async () => {
    const handle = await get_sync_folder_handle()
    folder_sync_name.value = handle?.name ?? ''
    const manifest = await get(SYNC_FOLDER_MANIFEST_KEY)
    folder_sync_last_at.value = manifest?.last_synced_at ?? null
  }

  const on_visibility = () => {
    if (document.visibilityState === 'visible' && sync_folder_pref.value)
      schedule_folder_drain()
  }

  mounted(() => {
    void refresh_name()
    document.addEventListener('visibilitychange', on_visibility)
  })

  dismount(() => {
    document.removeEventListener('visibilitychange', on_visibility)
    if (drain_timer) clearTimeout(drain_timer)
  })

  watch(
    () => sync_folder_pref.value,
    async enabled => {
      if (!enabled) {
        cancel_folder_sync()
        const queue_mutex = mutex_for('sync:folder-queue')
        await queue_mutex.lock()
        try {
          await set(SYNC_FOLDER_QUEUE_KEY, [])
        } finally {
          queue_mutex.unlock()
        }
        await await_folder_sync_idle()
        folder_sync_status.value = 'idle'
        return
      }
      await await_folder_sync_idle()
      clear_failed_thoughts()
      void drain_folder_queue({ force: true, set_working })
    }
  )

  const choose_folder = async () => {
    await choose_sync_folder()
    if (sync_folder_pref.value) {
      clear_failed_thoughts()
      await drain_folder_queue({ force: true, set_working })
    }
  }

  const sync_now = () => {
    clear_failed_thoughts()
    return drain_folder_queue({ force: true, set_working })
  }

  /** @deprecated Prefer choose_folder / sync_now */
  const sync_folder = async () => {
    if (!(await get_sync_folder_handle())) await choose_folder()
    else await sync_now()
  }

  return {
    sync_folder,
    choose_folder,
    sync_now,
    cancel_folder_sync,
    sync_folder_name: folder_sync_name,
    folder_sync_status,
    folder_sync_last_at,
    folder_sync_error,
    folder_sync_progress,
    refresh_name
  }
}
