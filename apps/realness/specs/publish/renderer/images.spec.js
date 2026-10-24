import assert from 'node:assert/strict'
import { it } from 'node:test'
import { create_images } from '../../../tools/publish/renderer/src/images.js'

it('poster names cannot read or write outside the poster folder', async () => {
  const images = create_images('example.svg')
  for (const name of [
    '../private.svg',
    '/private.svg',
    'folder/private.svg',
    'private\\image.svg'
  ])
    await assert.rejects(images.raster_og_image(name), /invalid poster name/)
})
