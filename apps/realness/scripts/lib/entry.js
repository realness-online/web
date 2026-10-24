import path from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

/**
 * True when the module at this URL is the script Node was asked to run.
 * @param {string} meta_url
 */
export const is_entry = meta_url =>
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === file_url_to_path(meta_url)

/**
 * Run a script's main as a command: print a thrown message and exit 1.
 * @param {string} meta_url
 * @param {() => unknown} main
 */
export const run_entry = async (meta_url, main) => {
  if (!is_entry(meta_url)) return
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
