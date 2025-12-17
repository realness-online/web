import chalk from 'chalk'
import { download_from_firebase } from './firebase-service.js'
const main = async () => {
  const { successful, failed } = await download_from_firebase('production')
  console.info('\nDownload Summary:')
  console.info(`${chalk.dim('Total files:')}    ${successful + failed}`)
  console.info(`${chalk.dim('Successful:')}     ${chalk.green(successful)}`)
  console.info(
    `${chalk.dim('Failed:')}         ${failed > 0 ? chalk.red(failed) : chalk.green('0')}`
  )
  console.info(chalk.green.bold('\nDownload process completed'))
}

main()
