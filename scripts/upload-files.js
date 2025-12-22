import { readdir, access } from 'fs/promises'
import { join } from 'path'
import { constants } from 'fs'
import chalk from 'chalk'
import { upload_to_firebase, cleanup_old_posters } from './firebase-service.js'

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
      const upload_path = full_path.replace(
        `${DATA_DIR}/compressed/`,
        'people/'
      )
      files.push({
        compressed_path: full_path,
        metadata_path,
        upload_path
      })
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

    try {
      await access(COMPRESSED_DIR, constants.F_OK)
    } catch {
      console.error(
        chalk.red.bold('\nError: ') +
          chalk.yellow('Compressed directory does not exist.\n') +
          chalk.dim('Run ') +
          chalk.cyan('npm run storage:compress') +
          chalk.dim(' first to create compressed files.')
      )
      process.exit(1)
    }

    const files = await get_compressed_files(COMPRESSED_DIR)

    if (files.length === 0) {
      console.info(chalk.yellow('No compressed files found!'))
      return
    }

    // Cleanup old files first
    console.info(chalk.bold('\nCleaning up old files...'))
    const { deleted, failed } = await cleanup_old_posters('development')

    if (failed > 0) {
      console.info(chalk.dim('Failed: ') + chalk.red(failed))
    }

    await upload_to_firebase(files, 'development')

    console.info(chalk.green.bold('\nMigration completed successfully'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
