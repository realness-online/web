import type { types } from './vocabulary.js'

/** A Realness item path, such as `/+123456/thoughts/789`. */
export type Id = string
/** Milliseconds since the epoch, from the item path. */
export type Created = number
export type Type = (typeof types)[number]
