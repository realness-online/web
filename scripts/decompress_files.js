import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname, relative } from 'path'
import { gunzip } from 'zlib'
import { promisify } from 'util'
import chalk from 'chalk'
import crypto from 'crypto'

const gunzip_async = promisify(gunzip)
const DATA_DIR = 'storage'
const COMPRESSED_DIR = join(DATA_DIR, 'compressed')
const PEOPLE_DIR = join(DATA_DIR, 'people')

const create_hash = async (data, algorithm = 'SHA-256') => {
  const hash = crypto.createHash(algorithm.toLowerCase())
  hash.update(data)
  return hash.digest('base64')
}

const verify_file = async (decompressed, metadata) => {
  const content_hash = await create_hash(decompressed)
  const md5_hash = await create_hash(decompressed, 'MD5')

  const expected_hash = metadata.metadata.customMetadata.hash.replace(/"/g, '')
  const expected_md5 = metadata.metadata.md5Hash

  const hash_matches = content_hash === expected_hash
  const md5_matches = md5_hash === expected_md5

  if (!hash_matches || !md5_matches) {
    console.log(chalk.yellow('Hash verification:'))
    console.log(
      chalk.dim('Content Hash: ') +
        (hash_matches ? chalk.green('✓') : chalk.red('✗'))
    )
    console.log(
      chalk.dim('MD5 Hash: ') +
        (md5_matches ? chalk.green('✓') : chalk.red('✗'))
    )
    return false
  }

  return true
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
    console.log(chalk.yellow('Decompressing...'))
    const decompressed = await gunzip_async(compressed_content)

    // Verify file integrity
    console.log(chalk.yellow('Verifying...'))
    if (!(await verify_file(decompressed, metadata)))
      throw new Error('File verification failed')

    console.log(chalk.green('✓ Verification successful'))

    // Write decompressed file and metadata
    await writeFile(output_path, decompressed)
    await writeFile(`${output_path}.metadata.json`, metadata_content)

    console.log(chalk.dim('Saved to: ') + output_path)
    return true
  } catch (error) {
    console.error(chalk.red('Decompression failed:'), error)
    return false
  }
}

const main = async () => {
  try {
    console.log(chalk.bold('Starting decompression process'))
    console.log(chalk.dim('Source directory: ') + chalk.cyan(COMPRESSED_DIR))
    console.log(chalk.dim('Target directory: ') + chalk.cyan(PEOPLE_DIR))

    const files = await get_compressed_files(COMPRESSED_DIR)
    console.log(chalk.dim('Found files: ') + chalk.green(files.length))

    let successful = 0
    let failed = 0

    for (const { compressed_path, metadata_path } of files) {
      console.log(chalk.cyan('\nProcessing: ') + chalk.dim(compressed_path))

      if (await decompress_file(compressed_path, metadata_path)) {
        successful++
        console.log(chalk.green('✓ Decompression successful'))
      } else {
        failed++
        console.log(chalk.red('✗ Decompression failed'))
      }

      // Show progress
      const total = successful + failed
      const progress = Math.round((total / files.length) * 100)
      console.log(
        chalk.dim(`Progress: ${progress}% (${total}/${files.length})`)
      )
    }

    console.log(chalk`
{bold Decompression Summary:}
{dim Total files:}    ${successful + failed}
{dim Successful:}     {green ${successful}}
{dim Failed:}         ${failed > 0 ? chalk.red(failed) : chalk.green('0')}
`)

    console.log(chalk.green.bold('\nDecompression completed'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
