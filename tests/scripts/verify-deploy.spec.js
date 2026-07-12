import { describe, it, expect } from 'vite-plus/test'
import { release_tag_candidates } from '../../scripts/verify-deploy.js'

describe('release_tag_candidates', () => {
  it('tries bare and v-prefixed tags', () => {
    expect(release_tag_candidates('2.5.8')).toEqual(['2.5.8', 'v2.5.8'])
    expect(release_tag_candidates('v2.5.8')).toEqual(['v2.5.8', '2.5.8'])
  })
})
