import { use as use_vectorize } from '@/use/vectorize'
import { use as use_optimizer } from '@/use/optimize'
import { ref } from 'vue'

export const use = () => {
  const { new_vector, new_gradients, process_photo } = use_vectorize()
  const progress = ref({
    total: 0,
    current: 0,
    processing: false,
    current_file: ''
  })
  const current_preview = ref(null)
  const completed_poster = ref(null)

  const process_directory = async () => {
    try {
      progress.value.processing = true
      current_preview.value = null
      completed_poster.value = null

      console.info('🗂️ Starting directory processing...')

      const source_dir = await /** @type {any} */ (window).showDirectoryPicker({
        mode: 'read',
        startIn: 'pictures',
        id: 'source-images'
      })

      // Count total image files
      let image_count = 0
      for await (const [name, handle] of source_dir.entries())
        if (
          handle.kind === 'file' &&
          name.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|avif|svg)$/i)
        )
          image_count++

      progress.value.total = image_count
      console.info(`📂 Found ${image_count} images to process`)

      const posters_dir = await source_dir.getDirectoryHandle('posters', {
        create: true
      })

      for await (const [name, handle] of source_dir.entries()) {
        if (handle.kind !== 'file') continue
        if (!name.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff|avif|svg)$/i))
          continue

        progress.value.current_file = name
        console.info(`🖼️ Processing file: ${name}`)

        const file = await handle.getFile()
        const image_url = URL.createObjectURL(file)

        try {
          await process_photo(image_url)

          // Wait for new_vector to be set by the vectorization process
          await new Promise(resolve => {
            const check_vector = () => {
              if (new_vector.value) resolve()
              else requestAnimationFrame(check_vector)
            }
            check_vector()
          })

          completed_poster.value = new_vector.value

          if (!completed_poster.value.optimized) {
            const { optimize: optimize_poster, vector: vector_ref } = use_optimizer(completed_poster)
            optimize_poster()
            await new Promise(resolve => {
              const check_optimized = () => {
                if (vector_ref.value.optimized) resolve()
                else requestAnimationFrame(check_optimized)
              }
              check_optimized()
            })
            // eslint-disable-next-line require-atomic-updates
            completed_poster.value = vector_ref.value
          }

          const svg_data = completed_poster.value
          const poster_name = name.replace(/\.[^/.]+$/, '.svg')
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
          console.info(`✅ Saved poster: ${poster_name}`)
        } catch (error) {
          console.error(`❌ Failed to process ${name}:`, error)
        } finally {
          URL.revokeObjectURL(image_url)
        }
      }

      console.info('🎉 Directory processing complete!')
    } catch (error) {
      console.error('❌ Directory processing failed:', error)
    } finally {
      progress.value.processing = false
      progress.value.current = 0
      progress.value.total = 0
      progress.value.current_file = ''
      // Cleanup after processing completes
      // eslint-disable-next-line require-atomic-updates
      completed_poster.value = null
    }
  }

  return {
    process_directory,
    progress,
    completed_poster
  }
}
