/**
 * `version_of` for Node code that hashes synchronously: the same string,
 * from node:crypto. specs/files/version.spec.js holds them equal.
 */
import { createHash as create_hash } from 'node:crypto'

const LENGTH = 22

/** @param {string | Buffer | Uint8Array} bytes */
export const version_sync = bytes =>
  create_hash('sha256').update(bytes).digest('base64url').slice(0, LENGTH)
