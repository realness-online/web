import { use as use_vectorize } from '@/use/vectorize'

const use_directory_processor = () => {
  const { new_vector, new_gradients, process_photo } = use_vectorize()

  const progress = ref({
    total: 0,
    current: 0,
    processing: false,
    current_file: ''
  })
  const current_preview = ref(null)

  const process_directory = async () => {
    try {
      progress.value.processing = true
      current_preview.value = null
      console.info('🗂️ Starting directory processing...')

      const source_dir = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'pictures',
        id: 'source-images'
      })

      // Count total image files
      let image_count = 0
      for await (const [name, handle] of source_dir.entries()) {
        if (handle.kind === 'file' && name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          image_count++
        }
      }
      progress.value.total = image_count
      console.info(`📂 Found ${image_count} images to process`)

      const posters_dir = await source_dir.getDirectoryHandle('posters', { create: true })

      for await (const [name, handle] of source_dir.entries()) {
        if (handle.kind !== 'file') continue
        if (!name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) continue

        progress.value.current_file = name
        console.info(`🖼️ Processing file: ${name}`)

        const file = await handle.getFile()
        const image_url = URL.createObjectURL(file)

        try {
          await process_photo(image_url)
          while (!new_vector.value) {
            await new Promise(r => setTimeout(r, 100))
          }

          // Update preview with current SVG
          current_preview.value = new_vector.value

          const svg_data = new_vector.value
          const poster_name = name.replace(/\.[^/.]+$/, '.svg')
          const poster_file = await posters_dir.getFileHandle(poster_name, { create: true })

          const writable = await poster_file.createWritable()
          await writable.write(svg_data)
          await writable.close()

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
      current_preview.value = null
    }
  }

  return {
    process_directory,
    progress,
    current_preview
  }
}

export { use_directory_processor }
