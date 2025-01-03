import { readdir } from 'fs/promises'
import { join } from 'path'
import chalk from 'chalk'
import { upload_to_firebase } from './firebase-service.js'

const DATA_DIR = 'storage'
const COMPRESSED_DIR = join(DATA_DIR, 'compressed')

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

const main = async () => {
  try {
    console.info(chalk.bold('Starting upload process'))
    console.info(chalk.dim('Data directory: ') + chalk.cyan(DATA_DIR))
    console.info(chalk.dim('Source directory: ') + chalk.cyan(COMPRESSED_DIR))

    const files = await get_compressed_files(COMPRESSED_DIR)

    if (files.length === 0) {
      console.info(chalk.yellow('No compressed files found!'))
      return
    }

    await upload_to_firebase(files)

    console.info(chalk.green.bold('\nUpload process completed'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
