/** @fileoverview Sync folder - export full poster output to user-selected directory. */

/** @typedef {import('@/types').Id} Id */

import {
  createApp,
  h,
  inject,
  nextTick as tick,
  ref,
  onMounted as mounted
} from 'vue'
import { get, set } from 'idb-keyval'
import PosterAsFigure from '@/components/posters/as-figure'
import { build_local_directory } from '@/persistance/Directory'
import {
  build_download_svg,
  get_filename_for_poster
} from '@/utils/export-poster'
import { as_query_id } from '@/utils/itemid'

export const sync_folder_supported = () =>
  'showDirectoryPicker' in window && 'FileSystemFileHandle' in window

const SVG_WAIT_TIMEOUT_MS = 15000

const wait_for_svg = (itemid, timeout_ms = SVG_WAIT_TIMEOUT_MS) => {
  const query_id = as_query_id(itemid)
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      const el = document.getElementById(query_id)
      if (el instanceof SVGSVGElement) return resolve(el)
      if (Date.now() - start > timeout_ms)
        return reject(new Error(`Timeout waiting for SVG: ${query_id}`))
      requestAnimationFrame(check)
    }
    check()
  })
}

const write_file = async (dir_handle, filename, blob) => {
  const file_handle = await dir_handle.getFileHandle(filename, { create: true })
  const writable = await file_handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

const export_poster_svg = async (itemid, svg_element, dir_handle) => {
  const download_svg = build_download_svg(svg_element)
  const svg_string = new XMLSerializer().serializeToString(download_svg)
  const blob = new Blob([svg_string], { type: 'image/svg+xml' })
  const filename = await get_filename_for_poster(itemid, 'svg')
  await write_file(dir_handle, filename, blob)
}

const SYNC_FOLDER_HANDLE_KEY = 'sync_folder_handle'

export const use = () => {
  const set_working = inject('set_working')
  const sync_folder_name = ref('')

  const load_sync_folder_name = async () => {
    const handle = await get(SYNC_FOLDER_HANDLE_KEY)
    sync_folder_name.value = handle?.name ?? ''
  }

  mounted(load_sync_folder_name)

  const sync_folder = async () => {
    const dir = await /** @type {any} */ (window).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
      id: 'sync-folder'
    })
    await set(SYNC_FOLDER_HANDLE_KEY, dir)
    sync_folder_name.value = dir.name

    const { me } = localStorage
    if (!me) return

    const posters_dir = await build_local_directory(
      /** @type {Id} */ (`${me}/posters/`)
    )
    const items = posters_dir?.items ?? []
    if (!items.length) return

    set_working?.(true)

    /* eslint-disable no-await-in-loop -- sequential: mount → export → unmount per poster */
    const container = document.createElement('div')
    container.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden'
    document.body.appendChild(container)

    for (const created of items) {
      const itemid = /** @type {Id} */ (`${me}/posters/${created}`)
      const app = createApp({
        name: 'SyncFolderPoster',
        render: () =>
          h(PosterAsFigure, {
            itemid,
            menu: false
          })
      })
      app.provide('set_working', () => {})
      app.mount(container)

      await tick()

      const svg = await wait_for_svg(itemid)
      await export_poster_svg(itemid, svg, dir)

      app.unmount()
    }

    container.remove()
    /* eslint-enable no-await-in-loop */
    set_working?.(false)
  }

  return { sync_folder, sync_folder_name }
}
