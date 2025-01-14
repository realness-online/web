import process from 'node:process'
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import chalk from 'chalk'
import { prepare_upload_html } from './node-upload-processor.js'
import { PERCENT, format_bytes } from '../src/utils/numbers.js'

// Define paths relative to project root
const DATA_DIR = 'storage'
const SOURCE_DIR = join(DATA_DIR, 'people')
const OUTPUT_DIR = join(DATA_DIR, 'compressed')

const ensure_dir = async dir_path => {
  try {
    await mkdir(dir_path, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

const get_html_files = async (dir_path, files = []) => {
  const entries = await readdir(dir_path, { withFileTypes: true })
  /* eslint-disable no-await-in-loop */
  for (const entry of entries) {
    const full_path = join(dir_path, entry.name)
    if (entry.isDirectory()) await get_html_files(full_path, files)
    else if (entry.name.endsWith('.html')) files.push(full_path)
  }

  return files
}

/**
 * @param {string} source_dir
 * @param {string} output_dir
 */
const process_directory = async (source_dir, output_dir) => {
  try {
    console.info(
      chalk.bold('Starting to process directory: ') + chalk.cyan(source_dir)
    )

    const html_files = await get_html_files(source_dir)
    console.info(
      chalk.bold('Found ') +
        chalk.green(html_files.length) +
        chalk.bold(' HTML files to process')
    )

    if (html_files.length === 0) {
      console.info(chalk.yellow('No HTML files found in directory tree'))
      return
    }

    let total_original = 0
    let total_compressed = 0
    /* eslint-disable no-await-in-loop */
    for (const file_path of html_files)
      try {
        const rel_path = relative(source_dir, file_path)
        const output_path = join(output_dir, rel_path)
        const output_dir_path = dirname(output_path)

        await ensure_dir(output_dir_path)

        const content = await readFile(file_path, 'utf-8')
        const original_size = content.length
        total_original += original_size

        console.info(`${chalk.bold('Processing: ')}${chalk.cyan(rel_path)}`)
        const { compressed, metadata } = await prepare_upload_html(content)
        const compressed_size = compressed?.length ?? 0
        total_compressed += compressed_size

        const compression_ratio = (
          ((original_size - compressed_size) / original_size) *
          PERCENT
        ).toFixed(1)

        console.info(chalk.dim('Original:    ') + format_bytes(original_size))
        console.info(chalk.dim('Compressed:  ') + format_bytes(compressed_size))
        console.info(
          chalk.dim('Reduction:   ') + chalk.green(`${compression_ratio}%`)
        )

        const compressed_path = `${output_path}.gz`
        const metadata_path = `${output_path}.metadata.json`

        await writeFile(compressed_path, compressed)
        await writeFile(metadata_path, JSON.stringify(metadata, null, 2))
      } catch (file_error) {
        console.error(chalk.red(`Error processing file ${file_path}:`), file_error)
      }

    const total_ratio = (
      ((total_original - total_compressed) / total_original) *
      PERCENT
    ).toFixed(1)
    console.info(`\n${chalk.bold('Compression Summary:')}`)
    console.info(chalk.dim('Total original:    ') + format_bytes(total_original))
    console.info(chalk.dim('Total compressed:  ') + format_bytes(total_compressed))
    console.info(chalk.dim('Overall reduction: ') + chalk.green(`${total_ratio}%`))
  } catch (error) {
    console.error(chalk.red('Error in process_directory:'), error)
    throw error
  }
}

const main = async () => {
  try {
    console.info(
      `${
        chalk.bold('Directory Setup:\n') +
        chalk.dim('Data directory:      ') +
        chalk.cyan(DATA_DIR)
      }\n${chalk.dim('Source directory:    ')}${chalk.cyan(
        SOURCE_DIR
      )}\n${chalk.dim('Compressed directory:')}${chalk.cyan(OUTPUT_DIR)}`
    )

    // Ensure directories exist
    await ensure_dir(SOURCE_DIR)
    await ensure_dir(OUTPUT_DIR)

    await process_directory(SOURCE_DIR, OUTPUT_DIR)
    console.info(chalk.green.bold('\nCompression completed successfully'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
