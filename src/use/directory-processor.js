import { use as use_vectorize } from '@/use/vectorize'
import { use as use_optimizer } from '@/use/optimize'
import { ref, watch, inject } from 'vue'
import {
  count_image_files,
  is_image_file,
  poster_filename
} from '@/utils/image-files'

export const use = () => {
  const { new_vector, new_gradients, process_photo } = use_vectorize()
  const set_working = inject('set_working')
  const progress = ref({
    total: 0,
    current: 0,
    processing: false,
    current_file: ''
  })
  const current_preview = ref(null)
  /** @typedef {import('@/types').Poster} Poster */
  const completed_poster = ref(/** @type {Poster | null} */ (null))

  const process_directory = async () => {
    try {
      progress.value.processing = true
      if (set_working) set_working(true)
      current_preview.value = null
      completed_poster.value = null

      const source_dir = await /** @type {any} */ (window).showDirectoryPicker({
        mode: 'read',
        startIn: 'pictures',
        id: 'source-images'
      })

      progress.value.total = await count_image_files(source_dir.entries())

      const posters_dir = await source_dir.getDirectoryHandle('posters', {
        create: true
      })

      for await (const [name, handle] of source_dir.entries()) {
        if (handle.kind !== 'file' || !is_image_file(name)) continue

        progress.value.current_file = name

        const file = await handle.getFile()
        const image_url = URL.createObjectURL(file)

        try {
          await process_photo(image_url)

          // Wait for new_vector to be set by the vectorization process
          if (!new_vector.value)
            await new Promise(resolve => {
              const stop = watch(new_vector, () => {
                if (new_vector.value) {
                  stop()
                  resolve(undefined)
                }
              })
            })

          completed_poster.value = new_vector.value
          const poster = completed_poster.value
          if (!poster?.optimized) {
            const { optimize: optimize_poster, vector: vector_ref } =
              use_optimizer(completed_poster)
            if (!poster) return
            optimize_poster()
            if (!vector_ref.value?.optimized)
              await new Promise(resolve => {
                const stop = watch(
                  () => vector_ref.value?.optimized,
                  optimized => {
                    if (optimized) {
                      stop()
                      resolve(undefined)
                    }
                  }
                )
              })

            // eslint-disable-next-line require-atomic-updates
            completed_poster.value = vector_ref.value
          }

          const final_poster = completed_poster.value
          if (!final_poster) return
          const svg_data = final_poster.toString()
          const poster_name = poster_filename(name)
          const poster_file = await posters_dir.getFileHandle(poster_name, {
            create: true
          })

          const writable = await poster_file.createWritable()
          await writable.write(svg_data)
          await writable.close()

          // Cleanup after file write completes
          // eslint-disable-next-line require-atomic-updates
          new_vector.value = null
          if (new_gradients.value) new_gradients.value = null

          progress.value.current++
        } catch (error) {
          console.error(`❌ Failed to process ${name}:`, error)
        } finally {
          URL.revokeObjectURL(image_url)
        }
      }
    } catch (error) {
      console.error('❌ Directory processing failed:', error)
    } finally {
      progress.value = {
        total: 0,
        current: 0,
        processing: false,
        current_file: ''
      }
      // eslint-disable-next-line require-atomic-updates
      completed_poster.value = null
      if (set_working) set_working(false)
    }
  }

  return {
    process_directory,
    progress,
    completed_poster
  }
}
