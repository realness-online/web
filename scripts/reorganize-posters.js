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

      if (entry.isDirectory()) {
        await get_poster_files(full_path, files)
      } else if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
        // Found a poster: +phone/posters/{created_at}.html
        const path_parts = full_path.split('/')
        if (path_parts.includes('posters')) {
          files.push(full_path)
        }
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
    console.info(chalk.cyan('\nReorganizing: ') + chalk.dim(file_path))

    // Read the file content
    const content = await readFile(file_path, 'utf-8')

    // Extract parts: storage/people/+phone/posters/{created_at}.html
    const parts = file_path.split('/')
    const file_name = parts[parts.length - 1]
    const created_at = file_name.replace('.html', '')

    // Build new path: storage/people/+phone/posters/{created_at}/index.html
    const dir_parts = parts.slice(0, -1)
    const new_dir = join(...dir_parts, created_at)
    const new_path = join(new_dir, 'index.html')

    console.info(chalk.dim('Creating: ') + new_path)

    // Create directory
    await ensure_dir(new_dir)

    // Write to new location
    await writeFile(new_path, content)
    console.info(chalk.green('✓ Created new file'))

    // Also copy metadata if it exists
    const old_metadata = `${file_path}.metadata.json`
    const new_metadata = `${new_path}.metadata.json`

    try {
      const metadata = await readFile(old_metadata, 'utf-8')
      await writeFile(new_metadata, metadata)
      console.info(chalk.green('✓ Copied metadata'))
    } catch (e) {
      console.info(chalk.yellow('⚠ No metadata found'))
    }

    // Delete old file and metadata
    await rm(file_path)
    try {
      await rm(old_metadata)
    } catch (e) {
      // Metadata might not exist
    }
    console.info(chalk.green('✓ Deleted old file'))

    return { success: true, old_path: file_path, new_path }
  } catch (error) {
    console.error(chalk.red('✗ Reorganization failed:'), error)
    return { success: false, old_path: file_path, error: error.message }
  }
}

const main = async () => {
  try {
    console.info(chalk.bold('Starting poster reorganization'))
    console.info(chalk.dim('Converting single-file to folder structure\n'))
    console.info(chalk.dim('Source directory: ') + chalk.cyan(PEOPLE_DIR))

    const poster_files = await get_poster_files(PEOPLE_DIR)

    console.info(
      chalk.dim('\nFound poster files: ') + chalk.green(poster_files.length)
    )

    if (poster_files.length === 0) {
      console.info(chalk.yellow('No poster files found!'))
      console.info(chalk.dim('Have you run download-files.js yet?'))
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
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
