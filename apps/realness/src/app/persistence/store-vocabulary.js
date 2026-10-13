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
  get sizes() {
    return SIZE
  }
}
