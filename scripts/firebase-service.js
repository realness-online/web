import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import chalk from 'chalk'
import { initializeApp, cert } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import 'dotenv/config'

const gunzip_async = promisify(gunzip)
const DATA_DIR = 'storage'
const SERVICE_ACCOUNT_PATH = join(DATA_DIR, 'service-account.json')
const PEOPLE_DIR = join(DATA_DIR, 'people')

const init_firebase = async () => {
  try {
    console.info(chalk.dim('Initializing Firebase...'))
    const service_account = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf-8'))

    console.info(
      chalk.dim('Storage bucket: ') + chalk.cyan(process.env.VITE_STORAGE_BUCKET)
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

    for (const { compressed_path, metadata_path, upload_path } of files) {
      try {
        console.info(chalk.cyan('\nReading metadata for: ') + chalk.dim(compressed_path))
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
      const progress = Math.round((total / files.length) * 100)
      console.info(chalk.dim(`Progress: ${progress}% (${total}/${files.length})`))
    }

    return { successful, failed }
  } catch (error) {
    console.error(chalk.red.bold('Upload process failed:'), error)
    throw error
  }
}

export const download_from_firebase = async () => {
  try {
    const bucket = await init_firebase()

    console.info(chalk.cyan('\nListing files in Firebase Storage...'))
    const [files] = await bucket.getFiles({ prefix: 'people/' })

    console.info(chalk.dim('Found files: ') + chalk.green(files.length))

    let successful = 0
    let failed = 0

    for (const file of files) {
      try {
        console.info(chalk.cyan('\nProcessing: ') + chalk.dim(file.name))

        const [metadata] = await file.getMetadata()
        console.info(chalk.yellow('Downloading...'))
        const [content] = await file.download()

        const output_path = join(PEOPLE_DIR, file.name.replace('people/', ''))
        await ensure_dir(dirname(output_path))

        const metadata_path = `${output_path}.metadata.json`
        await writeFile(metadata_path, JSON.stringify(metadata, null, 2))

        if (metadata.contentEncoding === 'deflate') {
          console.info(chalk.yellow('Decompressing...'))
          const decompressed = await gunzip_async(content)
          const final_path = output_path.replace('.gz', '')
          await writeFile(final_path, decompressed)
          console.info(chalk.dim('Saved decompressed file: ') + final_path)
        } else {
          await writeFile(output_path, content)
          console.info(chalk.dim('Saved file: ') + output_path)
        }

        successful++
        console.info(chalk.green('✓ Processing successful'))
      } catch (error) {
        failed++
        console.error(chalk.red('✗ Processing failed:'), error)
      }

      const total = successful + failed
      const progress = Math.round((total / files.length) * 100)
      console.info(chalk.dim(`Progress: ${progress}% (${total}/${files.length})`))
    }

    return { successful, failed }
  } catch (error) {
    console.error(chalk.red('Download process failed:'), error)
    throw error
  }
}
