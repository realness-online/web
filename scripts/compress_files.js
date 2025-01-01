import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname, relative } from 'path'
import { prepare_upload_data } from './node_upload_processor.js'

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
}

const format_bytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ensure_dir = async (dir_path) => {
  try {
    await mkdir(dir_path, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

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

const process_directory = async (source_dir, output_dir) => {
  try {
    console.log(`${colors.bright}Starting to process directory:${colors.reset} ${colors.cyan}${source_dir}${colors.reset}`)

    const html_files = await get_html_files(source_dir)
    console.log(`${colors.bright}Found${colors.reset} ${colors.green}${html_files.length}${colors.reset} HTML files to process`)

    if (html_files.length === 0) {
      console.log(`${colors.yellow}No HTML files found in directory tree${colors.reset}`)
      return
    }

    let total_original = 0
    let total_compressed = 0

    for (const file_path of html_files) {
      try {
        const rel_path = relative(source_dir, file_path)
        const output_path = join(output_dir, rel_path)
        const output_dir_path = dirname(output_path)

        await ensure_dir(output_dir_path)

        const content = await readFile(file_path, 'utf-8')
        const original_size = content.length
        total_original += original_size

        console.log(`\n${colors.bright}Processing:${colors.reset} ${colors.cyan}${rel_path}${colors.reset}`)
        const { data, metadata } = await prepare_upload_data(content, file_path)
        const compressed_size = data.length
        total_compressed += compressed_size

        const compression_ratio = ((original_size - compressed_size) / original_size * 100).toFixed(1)

        console.log(`${colors.dim}Original:${colors.reset}    ${format_bytes(original_size)}`)
        console.log(`${colors.dim}Compressed:${colors.reset}  ${format_bytes(compressed_size)}`)
        console.log(`${colors.dim}Reduction:${colors.reset}   ${colors.green}${compression_ratio}%${colors.reset}`)

        const compressed_path = `${output_path}.gz`
        const metadata_path = `${output_path}.metadata.json`

        await writeFile(compressed_path, data)
        await writeFile(metadata_path, JSON.stringify(metadata, null, 2))

      } catch (file_error) {
        console.error(`${colors.red}Error processing file ${file_path}:${colors.reset}`, file_error)
      }
    }

    const total_ratio = ((total_original - total_compressed) / total_original * 100).toFixed(1)
    console.log(`\n${colors.bright}Compression Summary:${colors.reset}`)
    console.log(`${colors.dim}Total original:${colors.reset}    ${format_bytes(total_original)}`)
    console.log(`${colors.dim}Total compressed:${colors.reset}  ${format_bytes(total_compressed)}`)
    console.log(`${colors.dim}Overall reduction:${colors.reset} ${colors.green}${total_ratio}%${colors.reset}`)

  } catch (error) {
    console.error(`${colors.red}Error in process_directory:${colors.reset}`, error)
    throw error
  }
}

const main = async () => {
  try {
    const source_dir = process.argv[2]
    if (!source_dir) {
      throw new Error('Please provide a source directory path')
    }

    // Create output directory next to source
    const output_dir = `${source_dir}_compressed`

    console.log('Starting script with:')
    console.log('Source directory:', source_dir)
    console.log('Output directory:', output_dir)

    await process_directory(source_dir, output_dir)
    console.log('Script completed successfully')
  } catch (error) {
    console.error('Script failed:', error)
    process.exit(1)
  }
}

main()
