/**
 * Model latest: `claude-fable-latest`, `claude-opus-latest`, `gpt-sol-latest`, and so on.
 *
 * Each model family in Pi's catalog gets a virtual model that sends every
 * request to the family's newest version. A family is a model id without its
 * version numbers. Dated snapshots, previews, and existing `latest` ids stay out.
 * The short names in aliases.js route the same way.
 */
import { getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all'
import { newest_by_family } from './families.js'
import { aliases, resolve_target } from './aliases.js'

const levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

export default pi => {
  /** @type {Map<string, Map<string, string>>} */
  const latest = new Map()
  for (const provider of getBuiltinProviders()) {
    const models = getBuiltinModels(provider)
    const ids = new Set(models.map(model => model.id))
    const newest = newest_by_family([...ids])
    latest.set(provider, newest)
    for (const [id, target_id] of newest) {
      if (ids.has(id)) continue
      const target = models.find(model => model.id === target_id)
      pi.registerVirtualModel({
        provider,
        id,
        name: `${target.name} (latest)`,
        thinkingLevels: target.reasoning ? levels : ['off'],
        contextWindow: target.contextWindow,
        maxTokens: target.maxTokens,
        input: target.input,
        route: (request, ctx) => {
          const model = ctx.modelRegistry.find(provider, target_id)
          if (!model) throw new Error(`${provider}/${target_id} is not in the catalog`)
          return { model, thinkingLevel: request.thinkingLevel }
        }
      })
    }
  }
  for (const { provider, id, name, target } of aliases) {
    const target_id = resolve_target(provider, target, latest)
    pi.registerVirtualModel({
      provider,
      id,
      name,
      thinkingLevels: levels,
      route: (request, ctx) => {
        const model = ctx.modelRegistry.find(provider, target_id)
        if (!model) throw new Error(`${provider}/${target_id} is not in the catalog`)
        return { model, thinkingLevel: request.thinkingLevel }
      }
    })
  }
}
