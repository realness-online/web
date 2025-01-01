import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { createCanvas, loadImage } from 'canvas'
import { JSDOM } from 'jsdom'
import chalk from 'chalk'
import { route as vector_route } from '@/workers/vector.js'
import dotenv from 'dotenv'
import { create_svg } from './lib/render_svg.js'

// Load environment variables
dotenv.config()
const ADMIN_ID = process.env.VITE_ADMIN_ID

// Set up minimal browser environment
const dom = new JSDOM()
global.window = dom.window
global.document = dom.window.document

const DATA_DIR = 'storage'
const SOURCE_DIR = join(DATA_DIR, 'images')  // Where original images are
const PEOPLE_DIR = join(DATA_DIR, 'people')  // Where posters will go

const ensure_dir = async (dir_path) => {
  try {
    await mkdir(dir_path, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

const get_image_files = async (dir_path, files = []) => {
  const entries = await readdir(dir_path, { withFileTypes: true })

  for (const entry of entries) {
    const full_path = join(dir_path, entry.name)

    if (entry.isDirectory()) {
      await get_image_files(full_path, files)
    } else if (/\.(jpg|jpeg|png)$/i.test(entry.name)) {
      files.push(full_path)
    }
  }

  return files
}

const process_image = async (image_path, phone_number) => {
  try {
    console.log(chalk.cyan('\nProcessing: ') + chalk.dim(image_path))

    // Load image
    const image = await loadImage(image_path)
    const canvas = createCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)

    // TODO: Add vectorization and gradient generation
    // This is where we'll integrate the worker code

    // Generate SVG
    const svg = create_svg(poster)

    // Save both JSON and SVG
    const base_path = join(PEOPLE_DIR, phone_number, 'posters', `${timestamp}`)
    await ensure_dir(dirname(base_path))

    await writeFile(`${base_path}.json`, JSON.stringify(poster, null, 2))
    await writeFile(`${base_path}.svg`, svg)

    console.log(chalk.green('✓ Processing successful'))
    console.log(chalk.dim('Saved to: ') + base_path + '.{json,svg}')
    return true
  } catch (error) {
    console.error(chalk.red('Processing failed:'), error)
    return false
  }
}

const main = async () => {
  try {
    const phone_number = process.argv[2] || ADMIN_ID

    if (!phone_number) {
      throw new Error('No phone number provided and VITE_ADMIN_ID not set in .env')
    }

    if (!/^\+\d{10,}$/.test(phone_number)) {
      throw new Error('Phone number must be in format: +1234567890')
    }

    console.log(chalk.bold('Starting image vectorization'))
    console.log(chalk.dim('Phone number: ') + chalk.cyan(phone_number))
    console.log(chalk.dim('Source directory: ') + chalk.cyan(SOURCE_DIR))

    await ensure_dir(SOURCE_DIR)
    await ensure_dir(join(PEOPLE_DIR, phone_number))

    const image_files = await get_image_files(SOURCE_DIR)
    console.log(chalk.dim('Found images: ') + chalk.green(image_files.length))

    let successful = 0
    let failed = 0

    for (const image_path of image_files) {
      if (await process_image(image_path, phone_number)) {
        successful++
      } else {
        failed++
      }

      // Show progress
      const total = successful + failed
      const progress = Math.round((total / image_files.length) * 100)
      console.log(chalk.dim(`Progress: ${progress}% (${total}/${image_files.length})`))
    }

    console.log(chalk`
{bold Processing Summary:}
{dim Total images:}   ${successful + failed}
{dim Successful:}     {green ${successful}}
{dim Failed:}         ${failed > 0 ? chalk.red(failed) : chalk.green('0')}
`)

  } catch (error) {
    console.error(chalk.red.bold('\nScript failed:'), error)
    process.exit(1)
  }
}

main()
