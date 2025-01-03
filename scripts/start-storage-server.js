import { exec } from 'child_process'
import { resolve } from 'path'
import chalk from 'chalk'

const PROJECT_ROOT = process.cwd()
const STORAGE_PATH = resolve(PROJECT_ROOT, 'storage')
const CONFIG_PATH = resolve(PROJECT_ROOT, 'scripts/nginx/storage.conf')

const start_server = () => {
  console.log(chalk.cyan('Starting storage server...'))
  console.log(chalk.dim('Storage path: ') + STORAGE_PATH)

  // Update config with correct path
  exec(
    `sed -i 's|/absolute/path/to/your/project/storage|${STORAGE_PATH}|' ${CONFIG_PATH}`
  )

  // Start nginx
  exec(`nginx -c ${CONFIG_PATH}`, (error, stdout, stderr) => {
    if (error) {
      console.error(chalk.red('Failed to start server:'), error)
      return
    }
    console.log(chalk.green('✓ Server started'))
    console.log(`${chalk.cyan('Browse storage at: ')}http://localhost:8080`)
  })
}

start_server()
