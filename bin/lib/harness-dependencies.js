import { createRequire as create_require } from 'node:module'

export const harness_require = create_require(new URL('../../.pi/package.json', import.meta.url))
export const { parseHTML: parse_html } = harness_require('linkedom')
export const { Readability } = harness_require('@mozilla/readability')
export const TurndownService = harness_require('turndown')
