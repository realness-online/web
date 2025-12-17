import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import chalk from 'chalk'

const DATA_DIR = 'storage'
const PEOPLE_DIR = join(DATA_DIR, 'people')

const ensure_dir = async dir_path => {
  try {
    await mkdir(dir_path, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

const get_poster_files = async (dir_path, files = []) => {
  try {
    const entries = await readdir(dir_path, { withFileTypes: true })

    /* eslint-disable no-await-in-loop */
    for (const entry of entries) {
      const full_path = join(dir_path, entry.name)

      if (entry.isDirectory()) await get_poster_files(full_path, files)
      else if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
        const path_parts = full_path.split('/')
        if (path_parts.includes('posters')) files.push(full_path)
      }
    }
    /* eslint-enable no-await-in-loop */

    return files
  } catch (error) {
    if (error.code === 'ENOENT') return files
    throw error
  }
}

const reorganize_poster = async file_path => {
  try {
    const content = await readFile(file_path, 'utf-8')

    return { success: true, old_path: file_path, new_path }
  } catch (error) {
    console.error(chalk.red('✗ Reorganization failed:'), error)
    return { success: false, old_path: file_path, error: error.message }
  }
}

const main = async () => {
  try {
    console.time('Reorganization')
    console.info(chalk.bold('Starting poster reorganization'))
    console.info(chalk.dim('Converting single-file to folder structure\n'))
    console.info(chalk.dim('Source directory: ') + chalk.cyan(PEOPLE_DIR))

    const poster_files = await get_poster_files(PEOPLE_DIR)

    console.info(
      chalk.dim('\nFound poster files: ') + chalk.green(poster_files.length)
    )

    if (poster_files.length === 0) {
      console.info(chalk.yellow('No poster files found!'))
      return
    }

    let successful = 0
    let failed = 0
    const results = []

    /* eslint-disable no-await-in-loop */
    for (const file_path of poster_files) {
      const result = await reorganize_poster(file_path)
      results.push(result)

      if (result.success) successful++
      else failed++

      const total = successful + failed
      const progress = Math.round((total / poster_files.length) * 100)
      console.info(
        chalk.dim(`Progress: ${progress}% (${total}/${poster_files.length})`)
      )
    }
    /* eslint-enable no-await-in-loop */

    console.info(chalk.bold('\nReorganization Summary:'))
    console.info(chalk.dim('Total files: ') + (successful + failed))
    console.info(chalk.dim('Successful: ') + chalk.green(successful))
    console.info(
      chalk.dim('Failed: ') +
        (failed > 0 ? chalk.red(failed) : chalk.green('0'))
    )

    if (failed > 0) {
      console.info(chalk.yellow('\nFailed reorganizations:'))
      results
        .filter(r => !r.success)
        .forEach(r => {
          console.info(chalk.red(`  ${r.old_path}`))
          if (r.error) console.info(chalk.dim(`    Error: ${r.error}`))
        })
    }

    console.info(chalk.green.bold('\nReorganization completed'))
    console.info(
      chalk.dim('\nNext step: ') + chalk.cyan('node scripts/compress-files.js')
    )
    console.timeEnd('Reorganization')
  } catch (error) {
    console.timeEnd('Reorganization')
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
