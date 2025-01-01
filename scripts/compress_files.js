import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { prepare_upload_data } from './node_upload_processor.js'

const get_html_files = async (dir_path, files = []) => {
  const entries = await readdir(dir_path, { withFileTypes: true })

  for (const entry of entries) {
    const full_path = join(dir_path, entry.name)

    if (entry.isDirectory()) {
      await get_html_files(full_path, files)
    } else if (entry.name.endsWith('.html')) {
      files.push(full_path)
    }
  }

  return files
}

const process_directory = async (dir_path) => {
  try {
    console.log('Starting to process directory:', dir_path)

    // Get all html files recursively
    const html_files = await get_html_files(dir_path)
    console.log('HTML files to process:', html_files)

    if (html_files.length === 0) {
      console.log('No HTML files found in directory tree')
      return
    }

    // Process each file
    for (const file_path of html_files) {
      console.log(`\nProcessing file: ${file_path}`)
      try {
        // Read original file
        const content = await readFile(file_path, 'utf-8')
        console.log('File content length:', content.length)

        // Prepare upload data
        console.log('Preparing upload data...')
        const { data, metadata } = await prepare_upload_data(content, file_path)

        // Write compressed file
        const compressed_path = `${file_path}.gz`
        await writeFile(compressed_path, data)

        // Write metadata file
        const metadata_path = `${file_path}.metadata.json`
        await writeFile(metadata_path, JSON.stringify(metadata, null, 2))

        console.log('Successfully processed:', file_path)
      } catch (file_error) {
        console.error(`Error processing file ${file_path}:`, file_error)
      }
    }
  } catch (error) {
    console.error('Error in process_directory:', error)
    throw error
  }
}

// Main execution
const main = async () => {
  try {
    const directory = process.argv[2]
    if (!directory) {
      throw new Error('Please provide a directory path')
    }

    console.log('Starting script with directory:', directory)
    await process_directory(directory)
    console.log('Script completed successfully')
  } catch (error) {
    console.error('Script failed:', error)
    process.exit(1)
  }
}

main()
