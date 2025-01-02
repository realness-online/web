const use_directory_processor = () => {
  const process_directory = async () => {
    try {
      console.info('🗂️ Starting directory processing...')

      // Get source directory (images)
      const source_dir = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'pictures',
        id: 'source-images'
      })
      console.info('📂 Source directory selected:', source_dir.name)

      // Get destination directory (posters)
      const dest_dir = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
        id: 'poster-output'
      })
      console.info('📁 Destination directory selected:', dest_dir.name)

      // Process files
      for await (const [name, handle] of source_dir.entries()) {
        if (handle.kind !== 'file') continue
        console.info(`🖼️ Processing file: ${name}`)

        if (!/\.(jpg|jpeg|png)$/i.test(name)) continue

        const file = await handle.getFile()
        // Use existing vectorization logic here
        const poster = await process_image(file)

        // Write poster files
        const timestamp = Date.now()
        const poster_dir = await dest_dir.getDirectoryHandle('posters', { create: true })

        // Save JSON
        const json_file = await poster_dir.getFileHandle(`${timestamp}.json`, { create: true })
        const json_writer = await json_file.createWritable()
        await json_writer.write(JSON.stringify(poster, null, 2))
        await json_writer.close()

        // Save SVG
        const svg_file = await poster_dir.getFileHandle(`${timestamp}.svg`, { create: true })
        const svg_writer = await svg_file.createWritable()
        await svg_writer.write(create_svg(poster))
        await svg_writer.close()

        console.info(`✅ Completed processing: ${name}`)
      }

      console.info('🎉 Directory processing complete!')
    } catch (error) {
      console.error('❌ Directory processing failed:', error)
    }
  }

  return { process_directory }
}

export { use_directory_processor }
