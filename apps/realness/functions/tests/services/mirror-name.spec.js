import { describe, it, expect } from 'vitest'
import { mirror_name } from '#services/mirror-name.js'

describe('mirror_name', () => {
  it.each([
    ['people/+123/posters/123.html.gz', 'people/+123/posters/123.html'],
    ['people/+123/posters/123.html', 'people/+123/posters/123.html.gz'],
    ['people/+123/posters/archive/123.html.gz', 'people/+123/posters/archive/123.html'],
    ['people/+123/relations.html.gz', 'people/+123/relations.html'],
    ['people/+123/relations.html', 'people/+123/relations.html.gz']
  ])('pairs %s with %s', (name, paired) => {
    expect(mirror_name(name)).toBe(paired)
    expect(mirror_name(paired)).toBe(name)
  })

  it.each([
    'people/+123/photo.jpg',
    'people/+123/posters/123.html.gz.extra',
    'people/+123/posters/123.html.gzip',
    'other/123.html',
    'people-extra/123.html',
    ''
  ])('ignores %s', name => {
    expect(mirror_name(name)).toBeNull()
  })
})
