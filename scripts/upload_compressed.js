import { readdir } from 'fs/promises'
import { join } from 'path'
import chalk from 'chalk'
import { upload_to_firebase } from './firebase_uploader.js'

const DATA_DIR = 'storage'
const COMPRESSED_DIR = join(DATA_DIR, 'compressed')

const get_compressed_files = async (dir_path, files = []) => {
  const entries = await readdir(dir_path, { withFileTypes: true })

  for (const entry of entries) {
    const full_path = join(dir_path, entry.name)

    if (entry.isDirectory()) await get_compressed_files(full_path, files)
    else if (entry.name.endsWith('.html.gz')) {
      const metadata_path = full_path.replace('.gz', '.metadata.json')
      files.push({ compressed_path: full_path, metadata_path })
    }
  }

  return files
}

const main = async () => {
  try {
    console.log(chalk.bold('Starting upload process'))
    console.log(chalk.dim('Data directory: ') + chalk.cyan(DATA_DIR))
    console.log(chalk.dim('Source directory: ') + chalk.cyan(COMPRESSED_DIR))

    const files = await get_compressed_files(COMPRESSED_DIR)

    if (files.length === 0) {
      console.log(chalk.yellow('No compressed files found!'))
      return
    }

    await upload_to_firebase(files)

    console.log(chalk.green.bold('\nUpload process completed'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
