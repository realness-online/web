/** @fileoverview Realness's store vocabulary: which types upload, archive, and
 * page, and the size thresholds optimize uses. */
import { has_archive, has_history, types } from '@/types.js'
import { SIZE } from '@/utils/numbers'

export const vocabulary = {
  types,
  requires_timestamp: ['posters'],
  networkable: [
    'person',
    'relations',
    'thoughts',
    'posters',
    'shadows',
    'sediment',
    'sand',
    'gravel',
    'rocks',
    'boulders'
  ],
  archived: has_archive,
  paged: has_history,
  // A getter: the size table is only needed when optimize runs, and some specs
  // mock the numbers module without it.
  get sizes() {
    return SIZE
  }
}
