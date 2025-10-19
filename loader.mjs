import { pathToFileURL } from 'node:url'
import { resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = pathResolve(__dirname)

export function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('@/')) {
    const aliasPath = specifier.replace('@/', '')
    const resolvedPath = pathResolve(projectRoot, 'src', aliasPath)
    // Add .js extension if no extension is present
    const finalPath = resolvedPath.endsWith('.js')
      ? resolvedPath
      : `${resolvedPath}.js`
    return defaultResolve(pathToFileURL(finalPath).href, context)
  }
  return defaultResolve(specifier, context)
}
