// itemid parsing bound to this app's vocabulary. `paths` and the store both
// need it, so it is built once here from the same vocabulary.
import { create_itemid } from '@realness/itemid'
import { vocabulary } from './vocabulary.js'

export const itemid = create_itemid({
  types: vocabulary.types,
  requires_timestamp: vocabulary.requires_timestamp
})

export const { as_author, as_created_at, as_type } = itemid