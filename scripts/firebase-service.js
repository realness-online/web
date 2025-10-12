import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import chalk from 'chalk'
import { initializeApp, cert } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import 'dotenv/config'

const DATA_DIR = 'storage'
const SERVICE_ACCOUNT_PATH = join('scripts', 'service-account.json')
const PEOPLE_DIR = join(DATA_DIR, 'people')

const init_firebase = async () => {
  try {
    console.info(chalk.dim('Initializing Firebase...'))
    const service_account = JSON.parse(
      await readFile(SERVICE_ACCOUNT_PATH, 'utf-8')
    )

    console.info(
      chalk.dim('Storage bucket: ') +
        chalk.cyan(process.env.VITE_STORAGE_BUCKET)
    )

    initializeApp({
      credential: cert(service_account),
      storageBucket: process.env.VITE_STORAGE_BUCKET
    })

    const bucket = getStorage().bucket()
    console.info(chalk.green('✓ Firebase initialized'))
    return bucket
  } catch (error) {
    console.error(chalk.red('Firebase initialization failed:'), error)
    throw error
  }
}

const ensure_dir = async dir_path => {
  try {
    await mkdir(dir_path, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

export const upload_to_firebase = async files => {
  try {
    const bucket = await init_firebase()

    console.info(chalk.bold('\nStarting uploads:'))
    console.info(chalk.dim('Files to process: ') + chalk.green(files.length))

    let successful = 0
    let failed = 0

    /* eslint-disable no-await-in-loop */
    for (const { compressed_path, metadata_path, upload_path } of files) {
      try {
        console.info(
          chalk.cyan('\nReading metadata for: ') + chalk.dim(compressed_path)
        )
        const metadata = JSON.parse(await readFile(metadata_path, 'utf-8'))

        console.info(chalk.dim('Destination: ') + upload_path)

        console.info(chalk.yellow('Uploading...'))
        await bucket.upload(compressed_path, {
          metadata,
          destination: upload_path
        })

        successful++
        console.info(chalk.green('✓ Upload successful'))
      } catch (error) {
        failed++
        console.error(chalk.red('✗ Upload failed:'), error)
      }

      const total = successful + failed
      const PERCENT = 100
      const progress = Math.round((total / files.length) * PERCENT)
      console.info(
        chalk.dim(`Progress: ${progress}% (${total}/${files.length})`)
      )
    }
    /* eslint-enable no-await-in-loop */

    return { successful, failed }
  } catch (error) {
    console.error(chalk.red.bold('Upload process failed:'), error)
    throw error
  }
}

export const download_from_firebase = async () => {
  const bucket = await init_firebase()

  console.info(chalk.cyan('\nListing files in Firebase Storage...'))
  const [files] = await bucket.getFiles({ prefix: 'people/' })

  console.info(chalk.dim('Found files: ') + chalk.green(files.length))

  const BATCH_SIZE = 10
  let successful = 0
  let failed = 0

  const process_file = async file => {
    const [metadata] = await file.getMetadata()
    const [content] = await file.download()

    const output_path = join(PEOPLE_DIR, file.name.replace('people/', ''))
    await ensure_dir(dirname(output_path))

    const metadata_path = `${output_path}.metadata.json`
    await writeFile(metadata_path, JSON.stringify(metadata, null, 2))

    // Firebase Storage auto-decompresses .gz files on download
    const final_path = file.name.endsWith('.gz')
      ? output_path.replace('.gz', '')
      : output_path

    await writeFile(final_path, content)
  }

  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(file => process_file(file))
    )

    results.forEach(result => {
      if (result.status === 'fulfilled') successful++
      else {
        failed++
        console.error(chalk.red('✗ Failed:'), result.reason)
      }
    })

    const total = successful + failed
    const PERCENT = 100
    const progress = Math.round((total / files.length) * PERCENT)
    console.info(chalk.dim(`Progress: ${progress}% (${total}/${files.length})`))
  }
  /* eslint-enable no-await-in-loop */

  return { successful, failed }
}
