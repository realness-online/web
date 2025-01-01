import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import chalk from 'chalk'
import { initializeApp, cert } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'

const DATA_DIR = 'storage'
const SERVICE_ACCOUNT_PATH = join(DATA_DIR, 'service-account.json')

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

const upload_file = async (bucket, file_path, metadata_path) => {
  try {
    console.log(chalk.cyan('\nReading metadata for: ') + chalk.dim(file_path))
    const metadata = JSON.parse(
      await readFile(metadata_path, 'utf-8')
    )

    const destination = file_path.replace('_compressed/', '')
    console.log(chalk.dim('Destination: ') + destination)

    console.log(chalk.yellow('Uploading...'))
    await bucket.upload(file_path, {
      metadata,
      destination
    })

    console.log(chalk.green('✓ Upload successful'))
    return true
  } catch (error) {
    console.error(chalk.red('✗ Upload failed:'), error)
    return false
  }
}

export const upload_to_firebase = async (files) => {
  try {
    const bucket = await init_firebase()

    console.log(chalk.bold('\nStarting uploads:'))
    console.log(chalk.dim('Files to process: ') + chalk.green(files.length))

    let successful = 0
    let failed = 0

    for (const { compressed_path, metadata_path } of files) {
      if (await upload_file(bucket, compressed_path, metadata_path)) {
        successful++
      } else {
        failed++
      }

      // Show progress
      const total = successful + failed
      const progress = Math.round((total / files.length) * 100)
      console.log(chalk.dim(`Progress: ${progress}% (${total}/${files.length})`))
    }

    // Final summary
    console.log(chalk`
{bold Upload Summary:}
{dim Total files:}    ${successful + failed}
{dim Successful:}     {green ${successful}}
{dim Failed:}         ${failed > 0 ? chalk.red(failed) : chalk.green('0')}
`)

    return { successful, failed }
  } catch (error) {
    console.error(chalk.red.bold('Upload process failed:'), error)
    throw error
  }
}
