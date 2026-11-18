/**
 * Short names for the `/model` list: the family is the id, how it is paid is the name.
 * A target ending in `-latest` follows the family's newest version.
 * @type {{ provider: string, id: string, name: string, target: string }[]}
 */
export const aliases = [
  { provider: 'anthropic', id: 'fable', name: 'pro', target: 'claude-fable-latest' },
  { provider: 'anthropic', id: 'opus', name: 'pro', target: 'claude-opus-latest' },
  { provider: 'anthropic-credits', id: 'opus', name: 'api', target: 'claude-opus-5-5' },
  { provider: 'openai', id: 'astra', name: 'api', target: 'gpt-astra-latest' },
  { provider: 'openai', id: 'sol', name: 'api', target: 'gpt-sol-latest' },
  { provider: 'openrouter', id: 'kimi', name: 'api', target: 'moonshotai/kimi-k3.1-pro' },
  { provider: 'openrouter', id: 'deepseek', name: 'api', target: 'deepseek/deepseek-v4.1-flash-1017' }
]

/**
 * The physical id an alias target names, given each provider's newest-by-family map.
 * @param {string} provider
 * @param {string} target
 * @param {Map<string, Map<string, string>>} latest provider to family-latest id to newest id
 */
export const resolve_target = (provider, target, latest) => latest.get(provider)?.get(target) ?? target
