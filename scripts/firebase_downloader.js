import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { gunzip } from 'zlib'
import { promisify } from 'util'
import chalk from 'chalk'
import { initializeApp, cert } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'

const gunzip_async = promisify(gunzip)
const DATA_DIR = 'storage'
const PEOPLE_DIR = join(DATA_DIR, 'people')
const SERVICE_ACCOUNT_PATH = join(DATA_DIR, 'service-account.json')

const ensure_dir = async (dir_path) => {
  try {
    await mkdir(dir_path, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

const init_firebase = async () => {
  try {
    console.log(chalk.dim('Initializing Firebase...'))
    const service_account = JSON.parse(
      await readFile(SERVICE_ACCOUNT_PATH, 'utf-8')
    )

    initializeApp({
      credential: cert(service_account),
      storageBucket: 'your-project-id.appspot.com'
    })

    const bucket = getStorage().bucket()
    console.log(chalk.green('✓ Firebase initialized'))
    return bucket
  } catch (error) {
    console.error(chalk.red('Firebase initialization failed:'), error)
    throw error
  }
}

const download_and_decompress = async (bucket) => {
  try {
    console.log(chalk.cyan('\nListing files in Firebase Storage...'))
    const [files] = await bucket.getFiles({ prefix: 'people/' })

    console.log(chalk.dim('Found files: ') + chalk.green(files.length))

    let successful = 0
    let failed = 0

    for (const file of files) {
      try {
        console.log(chalk.cyan('\nProcessing: ') + chalk.dim(file.name))

        // Get file metadata
        const [metadata] = await file.getMetadata()
        console.log(chalk.dim('Created: ') + new Date(metadata.timeCreated).toLocaleString())

        // Download file
        console.log(chalk.yellow('Downloading...'))
        const [content] = await file.download()

        // Determine output path (always in people directory)
        const output_path = join(PEOPLE_DIR, file.name.replace('people/', ''))
        await ensure_dir(dirname(output_path))

        // Save metadata alongside the file
        const metadata_path = `${output_path}.metadata.json`
        await writeFile(metadata_path, JSON.stringify(metadata, null, 2))

        // Decompress if needed and save to people directory
        if (metadata.contentEncoding === 'gzip') {
          console.log(chalk.yellow('Decompressing...'))
          const decompressed = await gunzip_async(content)
          const final_path = output_path.replace('.gz', '')
          await writeFile(final_path, decompressed)
          console.log(chalk.dim('Saved decompressed file: ') + final_path)
        } else {
          await writeFile(output_path, content)
          console.log(chalk.dim('Saved file: ') + output_path)
        }

        successful++
        console.log(chalk.green('✓ Processing successful'))
      } catch (error) {
        failed++
        console.error(chalk.red('✗ Processing failed:'), error)
      }

      // Show progress
      const total = successful + failed
      const progress = Math.round((total / files.length) * 100)
      console.log(chalk.dim(`Progress: ${progress}% (${total}/${files.length})`))
    }

    return { successful, failed }
  } catch (error) {
    console.error(chalk.red('Download process failed:'), error)
    throw error
  }
}

const main = async () => {
  try {
    console.log(chalk.bold('Starting download process'))
    console.log(chalk.dim('Target directory: ') + chalk.cyan(PEOPLE_DIR))

    await ensure_dir(PEOPLE_DIR)
    const bucket = await init_firebase()
    const { successful, failed } = await download_and_decompress(bucket)

    console.log(chalk`
{bold Download Summary:}
{dim Total files:}    ${successful + failed}
{dim Successful:}     {green ${successful}}
{dim Failed:}         ${failed > 0 ? chalk.red(failed) : chalk.green('0')}
`)

    console.log(chalk.green.bold('\nDownload process completed'))
  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
