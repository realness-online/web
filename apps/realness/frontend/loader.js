import { pathToFileURL as path_to_file_url } from 'node:url'
import { resolve as path_resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const __dirname = file_url_to_path(new URL('.', import.meta.url))
const projectRoot = path_resolve(__dirname)

export const resolve = (specifier, context, defaultResolve) => {
  if (specifier.startsWith('@/')) {
    const aliasPath = specifier.replace('@/', '')
    const resolvedPath = path_resolve(projectRoot, 'src', aliasPath)
    const finalPath = resolvedPath.endsWith('.js')
      ? resolvedPath
      : `${resolvedPath}.js`
    return defaultResolve(path_to_file_url(finalPath).href, context)
  }
  return defaultResolve(specifier, context)
}
