import { pathToFileURL as path_to_file_url } from 'node:url'
import {
  readdir as read_directory,
  readFile as read_file
} from 'node:fs/promises'
import { frontend_out } from '#root/src/settings/output.js'

/** Every stylesheet in the built site's assets, joined. */
export const read_built_css = async () => {
  const assets = path_to_file_url(`${frontend_out('assets')}/`)
  const files = (await read_directory(assets)).filter(name =>
    name.endsWith('.css')
  )
  return (
    await Promise.all(
      files.map(name => read_file(new URL(name, assets), 'utf8'))
    )
  ).join('\n')
}
