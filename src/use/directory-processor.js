import { use as use_vectorize } from '@/use/vectorize'

const use_directory_processor = () => {
  const { new_vector, new_gradients, process_photo } = use_vectorize()

  const process_directory = async () => {
    try {
      console.info('🗂️ Starting directory processing...')

      const source_dir = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'pictures',
        id: 'source-images'
      })
      console.info('📂 Source directory selected:', source_dir.name)

      // Create posters subdirectory in source directory
      const posters_dir = await source_dir.getDirectoryHandle('posters', { create: true })
      console.info('📁 Created posters directory')

      for await (const [name, handle] of source_dir.entries()) {
        if (handle.kind !== 'file') continue
        if (!name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) continue

        console.info(`🖼️ Processing file: ${name}`)

        const file = await handle.getFile()
        const image_url = URL.createObjectURL(file)

        try {
          await process_photo(image_url)

          // Wait for worker processing to complete
          while (!new_vector.value) {
            await new Promise(r => setTimeout(r, 100))
          }

          // Get the SVG data
          const svg_data = new_vector.value

          // Create file in posters directory
          const poster_name = name.replace(/\.[^/.]+$/, '.svg')
          const poster_file = await posters_dir.getFileHandle(poster_name, { create: true })

          // Write the SVG data
          const writable = await poster_file.createWritable()
          await writable.write(svg_data)
          await writable.close()

          // Reset for next file
          new_vector.value = null
          if (new_gradients.value) new_gradients.value = null

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
    }
  }

  return { process_directory }
}

export { use_directory_processor }
