import { onMounted as on_mounted, onUnmounted as on_unmounted } from 'vue'
import { watch_for_updates } from './watch-for-updates.js'

/** @param {() => boolean} is_working */
export const use_reload_on_update = is_working => {
  const workers =
    typeof navigator === 'undefined' ? undefined : navigator.serviceWorker
  if (!workers) return
  let stop = () => {}
  on_mounted(() => {
    stop = watch_for_updates({
      workers,
      doc: document,
      is_working,
      reload: () => location.reload()
    })
  })
  on_unmounted(() => stop())
}
