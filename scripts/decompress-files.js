import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
import chalk from 'chalk'

const gunzip_async = promisify(gunzip)
const DATA_DIR = 'storage'
const COMPRESSED_DIR = join(DATA_DIR, 'compressed')
const PEOPLE_DIR = join(DATA_DIR, 'people')

const create_hash = (data, algorithm = 'SHA-256') => {
  const hash = crypto.createHash(algorithm.toLowerCase())
  hash.update(data)
  return hash.digest('base64')
}

const ensure_dir = async dir_path => {
  try {
    await mkdir(dir_path, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

const get_compressed_files = async (dir_path, files = []) => {
  const entries = await readdir(dir_path, { withFileTypes: true })

  /* eslint-disable no-await-in-loop */
  for (const entry of entries) {
    const full_path = join(dir_path, entry.name)

    if (entry.isDirectory()) await get_compressed_files(full_path, files)
    else if (entry.name.endsWith('.html.gz')) {
      const metadata_path = full_path.replace('.gz', '.metadata.json')
      files.push({ compressed_path: full_path, metadata_path })
    }
  }
  /* eslint-enable no-await-in-loop */
  return files
}

const decompress_file = async (compressed_path, metadata_path) => {
  try {
    // Read compressed content and metadata
    const [compressed_content, metadata_content] = await Promise.all([
      readFile(compressed_path),
      readFile(metadata_path, 'utf-8')
    ])
    const metadata = JSON.parse(metadata_content)

    // Get relative path and create output path
    const rel_path = relative(COMPRESSED_DIR, compressed_path)
    const output_path = join(PEOPLE_DIR, rel_path.replace('.gz', ''))

    // Ensure output directory exists
    await ensure_dir(dirname(output_path))

    // Decompress content
    console.info(chalk.yellow('Decompressing...'))
    const decompressed = await gunzip_async(compressed_content)

    // Write decompressed file and metadata
    await writeFile(output_path, decompressed)
    await writeFile(`${output_path}.metadata.json`, metadata_content)

    console.info(chalk.dim('Saved to: ') + output_path)
    return true
  } catch (error) {
    console.error(chalk.red('Decompression failed:'), error)
    return false
  }
}

const main = async () => {
  try {
    console.info(chalk.bold('Starting decompression process'))
    console.info(chalk.dim('Source directory: ') + chalk.cyan(COMPRESSED_DIR))
    console.info(chalk.dim('Target directory: ') + chalk.cyan(PEOPLE_DIR))

    const files = await get_compressed_files(COMPRESSED_DIR)
    console.info(chalk.dim('Found files: ') + chalk.green(files.length))

    let successful = 0
    let failed = 0

    /* eslint-disable no-await-in-loop */
    for (const { compressed_path, metadata_path } of files) {
      console.info(chalk.cyan('\nProcessing: ') + chalk.dim(compressed_path))

      if (await decompress_file(compressed_path, metadata_path)) {
        successful++
        console.info(chalk.green('✓ Decompression successful'))
      } else {
        failed++
        console.info(chalk.red('✗ Decompression failed'))
      }

      // Show progress
      const total = successful + failed
      const progress = Math.round((total / files.length) * 100)
      console.info(
        chalk.dim(`Progress: ${progress}% (${total}/${files.length})`)
      )
    }
    /* eslint-enable no-await-in-loop */
    console.info(
      chalk.bold('\nDecompression Summary:'),
      chalk.dim('Total files: '),
      chalk.green(successful + failed),
      chalk.dim('Successful: '),
      chalk.green(successful),
      chalk.dim('Failed: '),
      failed > 0 ? chalk.red(failed) : chalk.green('0')
    )

    console.info(chalk.green.bold('\nDecompression completed'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
