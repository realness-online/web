import {
  ref,
  shallowRef,
  computed,
  onMounted as mounted,
  onUnmounted as unmounted
} from 'vue'

/**
 * Vectorizing drags in potrace and the persistence layer, which is far too
 * much to carry before the first paint. So the module loads a frame after
 * mount, and until it lands every value here reads empty and every call is a
 * no-op. Nothing has to know whether it has arrived yet.
 */
export const use_vectorize_deferred = () => {
  /** @type {import('vue').ShallowRef<any>} */
  const api = shallowRef(null)
  const image_picker = ref(null)
  let dismount = () => {}

  mounted(() =>
    requestAnimationFrame(async () => {
      const { use } = await import('@/use/vectorize')
      // use() runs outside setup() here, so it cannot inject('image-picker').
      // The ref is already bound to the input, so hand it over directly.
      const loaded = use(image_picker)
      dismount = loaded.unmount
      // Swap the stub directive for the real file picker change listener
      if (loaded.vVectorizer?.mounted && image_picker.value)
        loaded.vVectorizer.mounted(image_picker.value)
      api.value = loaded
      // Pick up any queue items that survived a reload. The feed has already
      // loaded and these render in their own section, so it needs no refresh.
      await loaded.init_processing_queue()
    })
  )

  unmounted(() => dismount())

  return {
    image_picker,
    new_vector: computed(() => api.value?.new_vector.value ?? null),
    current_processing: computed(
      () => api.value?.current_processing.value ?? null
    ),
    queue_items: computed(() => api.value?.queue_items.value ?? []),
    select_photo: () => api.value?.select_photo(),
    open_camera: () => api.value?.open_camera(),
    /** @param {File[]} files */
    queue_supported_files: files =>
      api.value?.queue_supported_files(files) ?? false,
    /** @param {ClipboardItem[]} items */
    queue_supported_clipboard_items: items =>
      api.value?.queue_supported_clipboard_items(items) ?? false,
    init_processing_queue: async () => await api.value?.init_processing_queue()
  }
}
