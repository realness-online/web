// The template's vocabulary: one example type, `notes`. A type appears here, in
// `paths`, and nowhere else - the store itself is generic.
//
// `notes` carries a created-at timestamp in its itemid, so its id is
// `/<author>/notes/<created>`. Add a type, give it a route in `paths`, and the
// store picks it up.
export const vocabulary = {
  /** The types this app knows. */
  types: ['notes'],
  /** Types whose itemid must carry a created-at timestamp. */
  requires_timestamp: ['notes'],
  /** Types that are written to the backend. */
  networkable: ['notes'],
  /** Types that roll older items into archive directories. */
  archived: [],
  /** Types that keep a paged history. */
  paged: [],
  /** Archive thresholds, used only by archived types. */
  sizes: { MIN: 0, MID: 25, MAX: 50 }
}