import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname, relative } from 'path'
import chalk from 'chalk'
import { prepare_upload_data } from './node_upload_processor.js'

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
    console.log(chalk.bold('Starting to process directory: ') + chalk.cyan(source_dir))

    const html_files = await get_html_files(source_dir)
    console.log(chalk.bold('Found ') + chalk.green(html_files.length) + chalk.bold(' HTML files to process'))

    if (html_files.length === 0) {
      console.log(chalk.yellow('No HTML files found in directory tree'))
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

        console.log('\n' + chalk.bold('Processing: ') + chalk.cyan(rel_path))
        const { data, metadata } = await prepare_upload_data(content, file_path)
        const compressed_size = data.length
        total_compressed += compressed_size

        const compression_ratio = ((original_size - compressed_size) / original_size * 100).toFixed(1)

        console.log(chalk.dim('Original:    ') + format_bytes(original_size))
        console.log(chalk.dim('Compressed:  ') + format_bytes(compressed_size))
        console.log(chalk.dim('Reduction:   ') + chalk.green(`${compression_ratio}%`))

        const compressed_path = `${output_path}.gz`
        const metadata_path = `${output_path}.metadata.json`

        await writeFile(compressed_path, data)
        await writeFile(metadata_path, JSON.stringify(metadata, null, 2))

      } catch (file_error) {
        console.error(chalk.red(`Error processing file ${file_path}:`), file_error)
      }
    }

    const total_ratio = ((total_original - total_compressed) / total_original * 100).toFixed(1)
    console.log('\n' + chalk.bold('Compression Summary:'))
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
    const source_dir = process.argv[2]
    if (!source_dir) {
      throw new Error('Please provide a source directory path')
    }

    const output_dir = `${source_dir}_compressed`

    console.log(chalk`
{bold Starting script with:}
{dim Source directory:}  {cyan ${source_dir}}
{dim Output directory:} {cyan ${output_dir}}
`)

    await process_directory(source_dir, output_dir)
    console.log(chalk.green.bold('\nScript completed successfully'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
