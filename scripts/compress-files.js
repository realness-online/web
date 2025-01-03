import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname, relative } from 'path'
import chalk from 'chalk'
import { prepare_upload_data } from './node-upload-processor.js'

// Define paths relative to project root
const DATA_DIR = 'storage'
const SOURCE_DIR = join(DATA_DIR, 'people')
const OUTPUT_DIR = join(DATA_DIR, 'compressed')

const format_bytes = bytes => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ensure_dir = async dir_path => {
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

    if (entry.isDirectory()) await get_html_files(full_path, files)
    else if (entry.name.endsWith('.html')) files.push(full_path)
  }

  return files
}

const create_header_file = async (metadata, output_path) => {
  // Default values for metadata properties
  const default_headers = {
    cacheControl: 'public, max-age=31536000',
    contentLanguage: 'en',
    contentDisposition: 'inline',
    customMetadata: { hash: '"default-hash"' }
  }

  // Merge default headers with provided metadata
  const headers = [
    `add_header Cache-Control "${metadata?.cacheControl || default_headers.cacheControl}";`,
    `add_header Content-Language "${metadata?.contentLanguage || default_headers.contentLanguage}";`,
    `add_header Content-Disposition "${metadata?.contentDisposition || default_headers.contentDisposition}";`,
    `add_header ETag ${metadata?.customMetadata?.hash || default_headers.customMetadata.hash};`
  ].join('\n')

  const header_path = `${output_path}.headers.conf`
  await writeFile(header_path, headers)
}

const process_directory = async (source_dir, output_dir) => {
  try {
    console.log(chalk.bold('Starting to process directory: ') + chalk.cyan(source_dir))

    const html_files = await get_html_files(source_dir)
    console.log(
      chalk.bold('Found ') +
        chalk.green(html_files.length) +
        chalk.bold(' HTML files to process')
    )

    if (html_files.length === 0) {
      console.log(chalk.yellow('No HTML files found in directory tree'))
      return
    }

    let total_original = 0
    let total_compressed = 0

    for (const file_path of html_files)
      try {
        const rel_path = relative(source_dir, file_path)
        const output_path = join(output_dir, rel_path)
        const output_dir_path = dirname(output_path)

        await ensure_dir(output_dir_path)

        const content = await readFile(file_path, 'utf-8')
        const original_size = content.length
        total_original += original_size

        console.log(`\n${chalk.bold('Processing: ')}${chalk.cyan(rel_path)}`)
        const { data, metadata } = await prepare_upload_data(content, file_path)
        const compressed_size = data.length
        total_compressed += compressed_size

        const compression_ratio = (
          ((original_size - compressed_size) / original_size) *
          100
        ).toFixed(1)

        console.log(chalk.dim('Original:    ') + format_bytes(original_size))
        console.log(chalk.dim('Compressed:  ') + format_bytes(compressed_size))
        console.log(chalk.dim('Reduction:   ') + chalk.green(`${compression_ratio}%`))

        const compressed_path = `${output_path}.gz`
        const metadata_path = `${output_path}.metadata.json`

        await writeFile(compressed_path, data)
        await writeFile(metadata_path, JSON.stringify(metadata, null, 2))
        await create_header_file(metadata.metadata, output_path)
      } catch (file_error) {
        console.error(chalk.red(`Error processing file ${file_path}:`), file_error)
      }

    const total_ratio = (
      ((total_original - total_compressed) / total_original) *
      100
    ).toFixed(1)
    console.log(`\n${chalk.bold('Compression Summary:')}`)
    console.log(chalk.dim('Total original:    ') + format_bytes(total_original))
    console.log(chalk.dim('Total compressed:  ') + format_bytes(total_compressed))
    console.log(chalk.dim('Overall reduction: ') + chalk.green(`${total_ratio}%`))
  } catch (error) {
    console.error(chalk.red('Error in process_directory:'), error)
    throw error
  }
}

const main = async () => {
  try {
    console.log(chalk`
{bold Directory Setup:}
{dim Data directory:}       {cyan ${DATA_DIR}}
{dim Source directory:}     {cyan ${SOURCE_DIR}}
{dim Compressed directory:} {cyan ${OUTPUT_DIR}}
`)

    // Ensure directories exist
    await ensure_dir(SOURCE_DIR)
    await ensure_dir(OUTPUT_DIR)

    await process_directory(SOURCE_DIR, OUTPUT_DIR)
    console.log(chalk.green.bold('\nCompression completed successfully'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
